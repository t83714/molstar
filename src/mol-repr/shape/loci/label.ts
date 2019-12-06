/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { Loci } from '../../../mol-model/loci';
import { RuntimeContext } from '../../../mol-task';
import { stringToWords } from '../../../mol-util/string';
import { Text } from '../../../mol-geo/geometry/text/text';
import { ParamDefinition as PD } from '../../../mol-util/param-definition';
import { ColorNames } from '../../../mol-util/color/names';
import { ShapeRepresentation } from '../representation';
import { Representation, RepresentationParamsGetter, RepresentationContext } from '../../representation';
import { Shape } from '../../../mol-model/shape';
import { TextBuilder } from '../../../mol-geo/geometry/text/text-builder';
import { Sphere3D } from '../../../mol-math/geometry';
import { lociLabel } from '../../../mol-theme/label';

export interface LabelData {
    infos: { loci: Loci, label?: string }[]
}

const TextParams = {
    ...Text.Params,
    borderWidth: PD.Numeric(0.2, { min: 0, max: 0.5, step: 0.01 }),
    textColor: PD.Color(ColorNames.black),
    textSize: PD.Numeric(0.8, { min: 0.1, max: 5, step: 0.1 }),
    offsetZ: PD.Numeric(2, { min: 0, max: 10, step: 0.1 }),
}
type TextParams = typeof TextParams

const LabelVisuals = {
    'text': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<LabelData, TextParams>) => ShapeRepresentation(getTextShape, Text.Utils),
}
type LabelVisualName = keyof typeof LabelVisuals
const LabelVisualOptions = Object.keys(LabelVisuals).map(name => [name, stringToWords(name)] as [LabelVisualName, string])

export const LabelParams = {
    ...TextParams,
    visuals: PD.MultiSelect<LabelVisualName>(['text'], LabelVisualOptions),
}
export type LabelParams = typeof LabelParams
export type LabelProps = PD.Values<LabelParams>

//

const tmpSphere = Sphere3D()

function label(info: { loci: Loci, label?: string }) {
    return info.label || lociLabel(info.loci, { hidePrefix: true, htmlStyling: false })
}

function getLabelName(data: LabelData) {
    return data.infos.length === 1 ? label(data.infos[0]) : `${data.infos.length} Labels`
}

//

function buildText(data: LabelData, props: LabelProps, text?: Text): Text {
    const builder = TextBuilder.create(props, 128, 64, text)
    for (let i = 0, il = data.infos.length; i < il; ++i) {
        const info = data.infos[i]
        const sphere = Loci.getBoundingSphere(info.loci, tmpSphere)
        if (!sphere) continue
        const { center, radius } = sphere
        const text = label(info)
        builder.add(text, center[0], center[1], center[2], radius, 1, i)
    }
    return builder.getText()
}

function getTextShape(ctx: RuntimeContext, data: LabelData, props: LabelProps, shape?: Shape<Text>) {
    const text = buildText(data, props, shape && shape.geometry);
    const name = getLabelName(data)
    const getLabel = function (groupId: number) {
        return label(data.infos[groupId])
    }
    return Shape.create(name, data, text, () => props.textColor, () => props.textSize, getLabel)
}

//

export type LabelRepresentation = Representation<LabelData, LabelParams>
export function LabelRepresentation(ctx: RepresentationContext, getParams: RepresentationParamsGetter<LabelData, LabelParams>): LabelRepresentation {
    return Representation.createMulti('Label', ctx, getParams, Representation.StateBuilder, LabelVisuals as unknown as Representation.Def<LabelData, LabelParams>)
}