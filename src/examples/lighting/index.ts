/**
 * Copyright (c) 2019-2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { Canvas3DProps } from "../../mol-canvas3d/canvas3d";
import { BuiltInTrajectoryFormat } from "../../mol-plugin-state/formats/trajectory";
import { createPluginUI } from "../../mol-plugin-ui/react18";
import { PluginUIContext } from "../../mol-plugin-ui/context";
import { DefaultPluginUISpec } from "../../mol-plugin-ui/spec";
import { PluginCommands } from "../../mol-plugin/commands";
import { Script } from "../../mol-script/script";
import { StructureSelection } from "../../mol-model/structure/query";
import { Structure } from "../../mol-model/structure";
import { Asset } from "../../mol-util/assets";
import { Color } from "../../mol-util/color";
import "./index.html";
import type { Loci } from "../../mol-model/structure/structure/element/loci";
require("mol-plugin-ui/skin/light.scss");

type LoadParams = {
  url: string;
  format?: BuiltInTrajectoryFormat;
  isBinary?: boolean;
  assemblyId?: string;
};

type _Preset = Pick<Canvas3DProps, "postprocessing" | "renderer">;
type Preset = { [K in keyof _Preset]: Partial<_Preset[K]> };

const Canvas3DPresets = {
  illustrative: {
    canvas3d: <Preset>{
      postprocessing: {
        occlusion: {
          name: "on",
          params: {
            samples: 32,
            multiScale: { name: "off", params: {} },
            radius: 5,
            bias: 0.8,
            blurKernelSize: 15,
            resolutionScale: 1,
            color: Color(0x000000),
          },
        },
        outline: {
          name: "on",
          params: {
            scale: 1,
            threshold: 0.33,
            color: Color(0x000000),
            includeTransparent: true,
          },
        },
        shadow: {
          name: "off",
          params: {},
        },
      },
      renderer: {
        ambientIntensity: 1.0,
        light: [],
      },
    },
  },
  occlusion: {
    canvas3d: <Preset>{
      postprocessing: {
        occlusion: {
          name: "on",
          params: {
            samples: 32,
            multiScale: { name: "off", params: {} },
            radius: 5,
            bias: 0.8,
            blurKernelSize: 15,
            resolutionScale: 1,
          },
        },
        outline: {
          name: "off",
          params: {},
        },
        shadow: {
          name: "off",
          params: {},
        },
      },
      renderer: {
        ambientIntensity: 0.4,
        light: [
          {
            inclination: 180,
            azimuth: 0,
            color: Color.fromNormalizedRgb(1.0, 1.0, 1.0),
            intensity: 0.6,
          },
        ],
      },
    },
  },
  standard: {
    canvas3d: <Preset>{
      postprocessing: {
        occlusion: { name: "off", params: {} },
        outline: { name: "off", params: {} },
        shadow: { name: "off", params: {} },
      },
      renderer: {
        ambientIntensity: 0.4,
        light: [
          {
            inclination: 180,
            azimuth: 0,
            color: Color.fromNormalizedRgb(1.0, 1.0, 1.0),
            intensity: 0.6,
          },
        ],
      },
    },
  },
};

type Canvas3DPreset = keyof typeof Canvas3DPresets;

class Protein3dViewer {
  plugin: PluginUIContext;

  private radius = 5;
  private bias = 1.1;
  private preset: Canvas3DPreset = "standard";

  async init(target: string | HTMLElement) {
    this.plugin = await createPluginUI(
      typeof target === "string" ? document.getElementById(target)! : target,
      {
        ...DefaultPluginUISpec(),
        layout: {
          initial: {
            isExpanded: false,
            showControls: false,
          },
        },
        components: {
          controls: {
            left: "none",
            right: "none",
            top: "none",
            bottom: "none",
          },
        },
      }
    );

    //this.setPreset("illustrative");
    await this.loadByQueryParameter();
  }

  setPreset(preset: Canvas3DPreset) {
    const props = Canvas3DPresets[preset];
    if (props.canvas3d.postprocessing.occlusion?.name === "on") {
      props.canvas3d.postprocessing.occlusion.params.radius = this.radius;
      props.canvas3d.postprocessing.occlusion.params.bias = this.bias;
    }
    PluginCommands.Canvas3D.SetSettings(this.plugin, {
      settings: {
        ...props,
        renderer: {
          ...this.plugin.canvas3d!.props.renderer,
          ...props.canvas3d.renderer,
        },
        postprocessing: {
          ...this.plugin.canvas3d!.props.postprocessing,
          ...props.canvas3d.postprocessing,
        },
      },
    });
  }

  async loadByQueryParameter() {
    try {
      const uri = new URL(window.location.href);
      let assemblyId = uri.searchParams.get("assemblyId");
      if (!assemblyId) {
        assemblyId = "1";
      }
      let uniprot = uri.searchParams.get("uniprot");
      if (!uniprot) {
        uniprot = uri.searchParams.get("id");
      }
      if (!uniprot) {
        console.log(
          "No uniprot id provided... 3D Viewer will not load any 3d model."
        );
        return;
      }
      const res = await fetch(
        `https://alphafold.ebi.ac.uk/api/prediction/${uniprot}`
      );
      if (!res.ok) {
        throw new Error(
          `Failed to fetch ${uniprot} from alphafold: ${res.status} ${res.statusText}`
        );
      }
      const alphaFoldData = await res.json();
      if (!alphaFoldData?.length) {
        throw new Error(`No data found for ${uniprot} in alphafold DB.`);
      }
      let format = "pdb";
      let fileUrl = alphaFoldData[0]?.pdbUrl;
      if (!fileUrl) {
        fileUrl = alphaFoldData[0]?.cifUrl;
        format = "mmcif";
      }
      if (!fileUrl) {
        throw new Error(
          `No resource file url found for ${uniprot} in alphafold DB.`
        );
      }
      if (format === "pdb") {
        await this.loadSimple({ url: fileUrl, format });
      } else {
        await this.loadSimple({ url: fileUrl, format: "mmcif", assemblyId });
      }
    } catch (e) {
      console.error(e);
    }
  }

  async loadSimple({
    url,
    format = "mmcif",
    isBinary = false,
    assemblyId = "",
  }: LoadParams) {
    await this.plugin.clear();

    const data = await this.plugin.builders.data.download(
      { url: Asset.Url(url), isBinary },
      { state: { isGhost: true } }
    );
    const trajectory = await this.plugin.builders.structure.parseTrajectory(
      data,
      format
    );

    await this.plugin.builders.structure.hierarchy.applyPreset(
      trajectory,
      "default",
      {
        structure: assemblyId
          ? {
              name: "assembly",
              params: { id: assemblyId },
            }
          : {
              name: "model",
              params: {},
            },
        showUnitcell: false,
        representationPreset: "auto",
      }
    );
  }

  async load(
    { url, format = "mmcif", isBinary = true, assemblyId = "" }: LoadParams,
    radius: number = 5,
    bias: number = 1.1
  ) {
    await this.plugin.clear();

    const data = await this.plugin.builders.data.download(
      { url: Asset.Url(url), isBinary },
      { state: { isGhost: true } }
    );
    const trajectory = await this.plugin.builders.structure.parseTrajectory(
      data,
      format
    );
    const model = await this.plugin.builders.structure.createModel(trajectory);
    const structure = await this.plugin.builders.structure.createStructure(
      model,
      assemblyId
        ? { name: "assembly", params: { id: assemblyId } }
        : { name: "model", params: {} }
    );

    const polymer =
      await this.plugin.builders.structure.tryCreateComponentStatic(
        structure,
        "polymer"
      );
    if (polymer)
      await this.plugin.builders.structure.representation.addRepresentation(
        polymer,
        {
          type: "spacefill",
          color: "illustrative",
        }
      );

    const ligand =
      await this.plugin.builders.structure.tryCreateComponentStatic(
        structure,
        "ligand"
      );
    if (ligand)
      await this.plugin.builders.structure.representation.addRepresentation(
        ligand,
        {
          type: "ball-and-stick",
          color: "element-symbol",
          colorParams: { carbonColor: { name: "element-symbol", params: {} } },
        }
      );

    this.radius = radius;
    this.bias = bias;
    this.setPreset(this.preset);
  }
}

const protein3dViewer = new Protein3dViewer();

(window as any).Protein3dViewer = protein3dViewer;

/**
 * Query molecular structure and return a `Loci` for selection for other operations.
 *
 * @param {(Script | string)} queryScript
 * @return {*}  {Loci}
 */
function queryStructure(queryScript: Script | string): Loci {
  const data =
    protein3dViewer.plugin.managers.structure.hierarchy.current.structures[0]
      ?.cell.obj?.data;
  if (!data) {
    throw new Error("Cannot locate structure data.");
  }
  let inputScript: Script;
  if (typeof queryScript === "string") {
    // assume it's mol-script
    inputScript = {
      expression: queryScript,
      language: "mol-script",
    };
  } else {
    inputScript = queryScript;
  }
  const exp = Script.toExpression(inputScript);
  const selection = Script.getStructureSelection(exp, data);
  return StructureSelection.toLociWithSourceUnits(selection);
}

function showMessage(
  msg: string,
  title: string = "Message:",
  timeoutMs: number = 2000,
  key: string = ""
) {
  key = key
    ? key
    : `toast-message-${Math.random().toString().replace(".", "")}`;
  PluginCommands.Toast.Show(protein3dViewer.plugin, {
    title,
    message: msg,
    key,
    timeoutMs,
  });
}

function highlight(loci: Loci) {
  protein3dViewer.plugin.managers.interactivity.lociHighlights.highlightOnly({
    loci,
  });
}

function clearHighlight(loci: Loci) {
  protein3dViewer.plugin.managers.interactivity.lociHighlights.clearHighlights();
}

function select(loci: Loci) {
  protein3dViewer.plugin.managers.interactivity.lociSelects.select({ loci });
}

function deselect(loci: Loci) {
  protein3dViewer.plugin.managers.interactivity.lociSelects.deselect({ loci });
}

function deselectAll() {
  protein3dViewer.plugin.managers.interactivity.lociSelects.deselectAll();
}

function focus(loci: Loci) {
  protein3dViewer.plugin.managers.structure.focus.setFromLoci(loci);
}

/**
 * Extend an existing focus representation by adding new loci to it
 *
 * @param {Loci} loci
 */
function extendFocus(loci: Loci) {
  protein3dViewer.plugin.managers.structure.focus.addFromLoci(loci);
}

function clearFocus() {
  protein3dViewer.plugin.managers.structure.focus.clear();
}

/**
 * manipulate the camera to zoom in to provided loci
 *
 * @param {Loci} loci
 */
function zoomToLoci(loci: Loci) {
  protein3dViewer.plugin.managers.camera.focusLoci(loci);
}

function resetCamera() {
  protein3dViewer.plugin.managers.camera.reset();
}

const viewerApi = {
  Script,
  Structure,
  StructureSelection,
  PluginCommands,
  query: queryStructure,
  showMessage,
  highlight,
  clearHighlight,
  select,
  deselect,
  deselectAll,
  focus,
  extendFocus,
  clearFocus,
  zoomToLoci,
  resetCamera,
};

(window as any).Protein3dViewerApi = viewerApi;
