/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import * as ReactDOM from 'react-dom';
import { createPlugin, DefaultPluginSpec } from '../../mol-plugin';
import './index.html'
import { PluginContext } from '../../mol-plugin/context';
import { PluginCommands } from '../../mol-plugin/commands';
import { StateTransforms } from '../../mol-plugin-state/transforms';
import { Color } from '../../mol-util/color';
import { PluginStateObject as PSO, PluginStateObject } from '../../mol-plugin-state/objects';
import { AnimateModelIndex } from '../../mol-plugin-state/animation/built-in';
import { StateBuilder, StateObject, StateSelection } from '../../mol-state';
import { EvolutionaryConservation } from './annotation';
import { LoadParams, SupportedFormats, RepresentationStyle, ModelInfo, StateElements } from './helpers';
import { RxEventHelper } from '../../mol-util/rx-event-helper';
import { volumeStreamingControls } from './ui/controls';
import { PluginState } from '../../mol-plugin/state';
import { Scheduler } from '../../mol-task';
import { createProteopediaCustomTheme } from './coloring';
import { MolScriptBuilder as MS } from '../../mol-script/language/builder';
import { ColorNames } from '../../mol-util/color/names';
import { InitVolumeStreaming, CreateVolumeStreamingInfo } from '../../mol-plugin/behavior/dynamic/volume-streaming/transformers';
import { DefaultCanvas3DParams, Canvas3DProps } from '../../mol-canvas3d/canvas3d';
import { createStructureRepresentationParams } from '../../mol-plugin-state/helpers/structure-representation-params';
import { download } from '../../mol-util/download';
import { getFormattedTime } from '../../mol-util/date';
require('../../mol-plugin-ui/skin/light.scss')

class MolStarProteopediaWrapper {
    static VERSION_MAJOR = 4;
    static VERSION_MINOR = 0;

    private _ev = RxEventHelper.create();

    readonly events = {
        modelInfo: this._ev<ModelInfo>()
    };

    plugin: PluginContext;

    init(target: string | HTMLElement, options?: {
        customColorList?: number[]
    }) {
        this.plugin = createPlugin(typeof target === 'string' ? document.getElementById(target)! : target, {
            ...DefaultPluginSpec,
            animations: [
                AnimateModelIndex
            ],
            layout: {
                initial: {
                    isExpanded: false,
                    showControls: false
                }
            },
            components: {
                remoteState: 'none'
            }
        });

        const customColoring = createProteopediaCustomTheme((options && options.customColorList) || []);

        this.plugin.representation.structure.themes.colorThemeRegistry.add(customColoring);
        this.plugin.representation.structure.themes.colorThemeRegistry.add(EvolutionaryConservation.colorThemeProvider!);
        this.plugin.managers.lociLabels.addProvider(EvolutionaryConservation.labelProvider!);
        this.plugin.customModelProperties.register(EvolutionaryConservation.propertyProvider, true);
    }

    get state() {
        return this.plugin.state.data;
    }

    private download(b: StateBuilder.To<PSO.Root>, url: string) {
        return b.apply(StateTransforms.Data.Download, { url, isBinary: false })
    }

    private model(b: StateBuilder.To<PSO.Data.Binary | PSO.Data.String>, format: SupportedFormats) {
        const parsed = format === 'cif'
            ? b.apply(StateTransforms.Data.ParseCif).apply(StateTransforms.Model.TrajectoryFromMmCif)
            : b.apply(StateTransforms.Model.TrajectoryFromPDB);

        return parsed
            .apply(StateTransforms.Model.ModelFromTrajectory, { modelIndex: 0 }, { ref: StateElements.Model });
    }

    private structure(assemblyId: string) {
        const model = this.state.build().to(StateElements.Model);
        const props = {
            type: {
                name: 'assembly' as const,
                params: { id: assemblyId || 'deposited' }
            }
        }

        const s = model
            .apply(StateTransforms.Model.StructureFromModel, props, { ref: StateElements.Assembly });

        s.apply(StateTransforms.Model.StructureComplexElement, { type: 'atomic-sequence' }, { ref: StateElements.Sequence });
        s.apply(StateTransforms.Model.StructureComplexElement, { type: 'atomic-het' }, { ref: StateElements.Het });
        s.apply(StateTransforms.Model.StructureComplexElement, { type: 'water' }, { ref: StateElements.Water });

        return s;
    }

    private visual(_style?: RepresentationStyle, partial?: boolean) {
        const structure = this.getObj<PluginStateObject.Molecule.Structure>(StateElements.Assembly);
        if (!structure) return;

        const style = _style || { };

        const update = this.state.build();

        if (!partial || (partial && style.sequence)) {
            const root = update.to(StateElements.Sequence);
            if (style.sequence && style.sequence.hide) {
                root.delete(StateElements.SequenceVisual);
            } else {
                root.applyOrUpdate(StateElements.SequenceVisual, StateTransforms.Representation.StructureRepresentation3D,
                    createStructureRepresentationParams(this.plugin, structure, {
                        type: (style.sequence && style.sequence.kind) || 'cartoon',
                        color: (style.sequence && style.sequence.coloring) || 'unit-index'
                    }));
            }
        }

        if (!partial || (partial && style.hetGroups)) {
            const root = update.to(StateElements.Het);
            if (style.hetGroups && style.hetGroups.hide) {
                root.delete(StateElements.HetVisual);
            } else {
                if (style.hetGroups && style.hetGroups.hide) {
                    root.delete(StateElements.HetVisual);
                } else {
                    root.applyOrUpdate(StateElements.HetVisual, StateTransforms.Representation.StructureRepresentation3D,
                        createStructureRepresentationParams(this.plugin, structure, {
                            type: (style.hetGroups && style.hetGroups.kind) || 'ball-and-stick',
                            color: style.hetGroups && style.hetGroups.coloring
                        }));
                }
            }
        }

        if (!partial || (partial && style.snfg3d)) {
            const root = update.to(StateElements.Het);
            if (style.hetGroups && style.hetGroups.hide) {
                root.delete(StateElements.HetVisual);
            } else {
                if (style.snfg3d && style.snfg3d.hide) {
                    root.delete(StateElements.Het3DSNFG);
                } else {
                    root.applyOrUpdate(StateElements.Het3DSNFG, StateTransforms.Representation.StructureRepresentation3D,
                        createStructureRepresentationParams(this.plugin, structure, { type: 'carbohydrate' }));
                }
            }
        }

        if (!partial || (partial && style.water)) {
            const root = update.to(StateElements.Water);
            if (style.water && style.water.hide) {
                root.delete(StateElements.WaterVisual);
            } else {
                root.applyOrUpdate(StateElements.WaterVisual, StateTransforms.Representation.StructureRepresentation3D,
                    createStructureRepresentationParams(this.plugin, structure, {
                        type: (style.water && style.water.kind) || 'ball-and-stick',
                        typeParams: { alpha: 0.51 },
                        color: style.water && style.water.coloring
                    }));
            }
        }

        return update;
    }

    private getObj<T extends StateObject>(ref: string): T['data'] {
        const state = this.state;
        const cell = state.select(ref)[0];
        if (!cell || !cell.obj) return void 0;
        return (cell.obj as T).data;
    }

    private async doInfo(checkPreferredAssembly: boolean) {
        const model = this.getObj<PluginStateObject.Molecule.Model>('model');
        if (!model) return;

        const info = await ModelInfo.get(this.plugin, model, checkPreferredAssembly)
        this.events.modelInfo.next(info);
        return info;
    }

    private applyState(tree: StateBuilder) {
        return PluginCommands.State.Update(this.plugin, { state: this.plugin.state.data, tree });
    }

    private loadedParams: LoadParams = { url: '', format: 'cif', assemblyId: '' };
    async load({ url, format = 'cif', assemblyId = 'deposited', representationStyle }: LoadParams) {
        let loadType: 'full' | 'update' = 'full';

        const state = this.plugin.state.data;

        if (this.loadedParams.url !== url || this.loadedParams.format !== format) {
            loadType = 'full';
        } else if (this.loadedParams.url === url) {
            if (state.select(StateElements.Assembly).length > 0) loadType = 'update';
        }

        if (loadType === 'full') {
            await PluginCommands.State.RemoveObject(this.plugin, { state, ref: state.tree.root.ref });
            const modelTree = this.model(this.download(state.build().toRoot(), url), format);
            await this.applyState(modelTree);
            const info = await this.doInfo(true);
            const asmId = (assemblyId === 'preferred' && info && info.preferredAssemblyId) || assemblyId;
            const structureTree = this.structure(asmId);
            await this.applyState(structureTree);
        } else {
            const tree = state.build();
            const info = await this.doInfo(true);
            const asmId = (assemblyId === 'preferred' && info && info.preferredAssemblyId) || assemblyId;
            const props = {
                type: {
                    name: 'assembly' as const,
                    params: { id: asmId || 'deposited' }
                }
            }
            tree.to(StateElements.Assembly).update(StateTransforms.Model.StructureFromModel, p => ({ ...p, ...props }));
            await this.applyState(tree);
        }

        await this.updateStyle(representationStyle);

        this.loadedParams = { url, format, assemblyId };
        Scheduler.setImmediate(() => PluginCommands.Camera.Reset(this.plugin, { }));
    }

    async updateStyle(style?: RepresentationStyle, partial?: boolean) {
        const tree = this.visual(style, partial);
        if (!tree) return;
        await PluginCommands.State.Update(this.plugin, { state: this.plugin.state.data, tree });
    }

    setBackground(color: number) {
        if (!this.plugin.canvas3d) return;
        const renderer = this.plugin.canvas3d.props.renderer;
        PluginCommands.Canvas3D.SetSettings(this.plugin, { settings: { renderer: { ...renderer,  backgroundColor: Color(color) } } });
    }

    toggleSpin() {
        if (!this.plugin.canvas3d) return;
        const trackball = this.plugin.canvas3d.props.trackball;
        const spinning = trackball.spin;
        PluginCommands.Canvas3D.SetSettings(this.plugin, { settings: { trackball: { ...trackball, spin: !trackball.spin } } });
        if (!spinning) PluginCommands.Camera.Reset(this.plugin, { });
    }

    viewport = {
        setSettings: (settings?: Canvas3DProps) => {
            PluginCommands.Canvas3D.SetSettings(this.plugin, {
                settings: settings || DefaultCanvas3DParams
            });
        }
    };

    camera = {
        toggleSpin: () => this.toggleSpin(),
        resetPosition: () => PluginCommands.Camera.Reset(this.plugin, { }),
        // setClip: (options?: { distance?: number, near?: number, far?: number }) => {
        //     if (!options) {
        //         PluginCommands.Canvas3D.SetSettings(this.plugin, {
        //             settings: {
        //                 cameraClipDistance: DefaultCanvas3DParams.cameraClipDistance,
        //                 clip: DefaultCanvas3DParams.clip
        //             }
        //         });
        //         return;
        //     }

        //     options = options || { };
        //     const props = this.plugin.canvas3d.props;
        //     const clipNear = typeof options.near === 'undefined' ? props.clip[0] : options.near;
        //     const clipFar = typeof options.far === 'undefined' ? props.clip[1] : options.far;
        //     PluginCommands.Canvas3D.SetSettings(this.plugin, {
        //         settings: { cameraClipDistance: options.distance, clip: [clipNear, clipFar] }
        //     });
        // }
    }

    animate = {
        modelIndex: {
            maxFPS: 8,
            onceForward: () => { this.plugin.state.animation.play(AnimateModelIndex, { maxFPS: Math.max(0.5, this.animate.modelIndex.maxFPS | 0), mode: { name: 'once', params: { direction: 'forward' } } }) },
            onceBackward: () => { this.plugin.state.animation.play(AnimateModelIndex, { maxFPS: Math.max(0.5, this.animate.modelIndex.maxFPS | 0), mode: { name: 'once', params: { direction: 'backward' } } }) },
            palindrome: () => { this.plugin.state.animation.play(AnimateModelIndex, { maxFPS: Math.max(0.5, this.animate.modelIndex.maxFPS | 0), mode: { name: 'palindrome', params: {} } }) },
            loop: () => { this.plugin.state.animation.play(AnimateModelIndex, { maxFPS: Math.max(0.5, this.animate.modelIndex.maxFPS | 0), mode: { name: 'loop', params: {} } }) },
            stop: () => this.plugin.state.animation.stop()
        }
    }

    coloring = {
        evolutionaryConservation: async (params?: { sequence?: boolean, het?: boolean, keepStyle?: boolean }) => {
            if (!params || !params.keepStyle) {
                await this.updateStyle({ sequence: { kind: 'spacefill' } }, true);
            }

            const state = this.state;

            // const visuals = state.selectQ(q => q.ofType(PluginStateObject.Molecule.Structure.Representation3D).filter(c => c.transform.transformer === StateTransforms.Representation.StructureRepresentation3D));
            // for (const v of visuals) {
            // }

            const tree = state.build();
            const colorTheme = { name: EvolutionaryConservation.propertyProvider.descriptor.name, params: this.plugin.representation.structure.themes.colorThemeRegistry.get(EvolutionaryConservation.propertyProvider.descriptor.name).defaultValues };

            if (!params || !!params.sequence) {
                tree.to(StateElements.SequenceVisual).update(StateTransforms.Representation.StructureRepresentation3D, old => ({ ...old, colorTheme }));
            }
            if (params && !!params.het) {
                tree.to(StateElements.HetVisual).update(StateTransforms.Representation.StructureRepresentation3D, old => ({ ...old, colorTheme }));
            }

            await PluginCommands.State.Update(this.plugin, { state, tree });
        }
    }

    private experimentalDataElement?: Element = void 0;
    experimentalData = {
        init: async (parent: Element) => {
            const asm = this.state.select(StateElements.Assembly)[0].obj!;
            const params = InitVolumeStreaming.createDefaultParams(asm, this.plugin);
            params.options.behaviorRef = StateElements.VolumeStreaming;
            params.defaultView = 'box';
            params.options.channelParams['fo-fc(+ve)'] = { wireframe: true };
            params.options.channelParams['fo-fc(-ve)'] = { wireframe: true };
            await this.plugin.runTask(this.state.applyAction(InitVolumeStreaming, params, StateElements.Assembly));
            this.experimentalDataElement = parent;
            volumeStreamingControls(this.plugin, parent);
        },
        remove: () => {
            const r = this.state.select(StateSelection.Generators.ofTransformer(CreateVolumeStreamingInfo))[0];
            if (!r) return;
            PluginCommands.State.RemoveObject(this.plugin, { state: this.state, ref: r.transform.ref });
            if (this.experimentalDataElement) {
                ReactDOM.unmountComponentAtNode(this.experimentalDataElement);
                this.experimentalDataElement = void 0;
            }
        }
    }

    hetGroups = {
        reset: () => {
            const update = this.state.build().delete(StateElements.HetGroupFocusGroup);
            PluginCommands.State.Update(this.plugin, { state: this.state, tree: update });
            PluginCommands.Camera.Reset(this.plugin, { });
        },
        focusFirst: async (compId: string) => {
            if (!this.state.transforms.has(StateElements.Assembly)) return;
            await PluginCommands.Camera.Reset(this.plugin, { });

            // const asm = (this.state.select(StateElements.Assembly)[0].obj as PluginStateObject.Molecule.Structure).data;

            const update = this.state.build();

            update.delete(StateElements.HetGroupFocusGroup);

            const core = MS.struct.filter.first([
                MS.struct.generator.atomGroups({
                    'residue-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.label_comp_id(), compId]),
                    'group-by': MS.core.str.concat([MS.struct.atomProperty.core.operatorName(), MS.struct.atomProperty.macromolecular.residueKey()])
                })
            ]);
            const surroundings = MS.struct.modifier.includeSurroundings({ 0: core, radius: 5, 'as-whole-residues': true });

            const group = update.to(StateElements.Assembly).group(StateTransforms.Misc.CreateGroup, { label: compId }, { ref: StateElements.HetGroupFocusGroup });

            group.apply(StateTransforms.Model.StructureSelectionFromExpression, { label: 'Core', expression: core }, { ref: StateElements.HetGroupFocus })
                .apply(StateTransforms.Representation.StructureRepresentation3D, this.createCoreVisualParams());
            group.apply(StateTransforms.Model.StructureSelectionFromExpression, { label: 'Surroundings', expression: surroundings })
                .apply(StateTransforms.Representation.StructureRepresentation3D, this.createSurVisualParams());
            // sel.apply(StateTransforms.Representation.StructureLabels3D, {
            //     target: { name: 'residues', params: { } },
            //     options: {
            //         ...ParamDefinition.getDefaultValues(Text.Params),
            //         background: true,
            //         backgroundMargin: 0.2,
            //         backgroundColor: ColorNames.snow,
            //         backgroundOpacity: 0.9,
            //     }
            // });

            await PluginCommands.State.Update(this.plugin, { state: this.state, tree: update });

            const focus = (this.state.select(StateElements.HetGroupFocus)[0].obj as PluginStateObject.Molecule.Structure).data;
            const sphere = focus.boundary.sphere;
            // const asmCenter = asm.boundary.sphere.center;
            // const position = Vec3.sub(Vec3.zero(), sphere.center, asmCenter);
            // Vec3.normalize(position, position);
            // Vec3.scaleAndAdd(position, sphere.center, position, sphere.radius);
            const radius = Math.max(sphere.radius, 5)
            const snapshot = this.plugin.canvas3d!.camera.getFocus(sphere.center, radius);
            PluginCommands.Camera.SetSnapshot(this.plugin, { snapshot, durationMs: 250 });
        }
    }

    private createSurVisualParams() {
        const asm = this.state.select(StateElements.Assembly)[0].obj as PluginStateObject.Molecule.Structure;
        return createStructureRepresentationParams(this.plugin, asm.data, {
            type: 'ball-and-stick',
            color: 'uniform', colorParams: { value: ColorNames.gray },
            size: 'uniform', sizeParams: { value: 0.33 }
        });
    }

    private createCoreVisualParams() {
        const asm = this.state.select(StateElements.Assembly)[0].obj as PluginStateObject.Molecule.Structure;
        return createStructureRepresentationParams(this.plugin, asm.data, {
            type: 'ball-and-stick'
        });
    }

    snapshot = {
        get: () => {
            return this.plugin.state.getSnapshot();
        },
        set: (snapshot: PluginState.Snapshot) => {
            return this.plugin.state.setSnapshot(snapshot);
        },
        download: () => {
            const json = JSON.stringify(this.plugin.state.getSnapshot(), null, 2);
            const blob = new Blob([json], {type : 'application/json;charset=utf-8'});
            download(blob, `mol-star_state_${(name || getFormattedTime())}.json`)
        },
        fetch: async (url: string) => {
            try {
                const snapshot = await this.plugin.runTask(this.plugin.fetch({ url, type: 'json' }));
                // TODO: is this OK to test for snapshots from server?
                await this.plugin.state.setSnapshot(snapshot?.data?.entries[0]?.snapshot || snapshot);
            } catch (e) {
                console.log(e);
            }
        }

    }
}

(window as any).MolStarProteopediaWrapper = MolStarProteopediaWrapper;