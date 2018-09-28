/**
 * Copyright (c) 2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import * as React from 'react'
import Viewer from 'mol-view/viewer';
import { ColorThemeProps, ColorThemeName, ColorThemeNames, ColorTheme } from 'mol-view/theme/color';
import { Color } from 'mol-util/color';
import { Progress } from 'mol-task';
import { VisualQuality, VisualQualityNames } from 'mol-geo/geometry/geometry';
import { SizeThemeProps } from 'mol-view/theme/size';
import { App } from '../app';
import { VolumeRepresentation, VolumeProps } from 'mol-geo/representation/volume';

export interface VolumeRepresentationComponentProps {
    app: App
    viewer: Viewer
    representation: VolumeRepresentation<VolumeProps>
}

export interface VolumeRepresentationComponentState {
    label: string
    visible: boolean
    alpha: number
    quality: VisualQuality
    colorTheme: ColorThemeProps
    depthMask: boolean

    flatShaded?: boolean
    resolutionFactor?: number
    radiusOffset?: number
    smoothness?: number
    pointSizeAttenuation?: boolean
    pointFilledCircle?: boolean
    pointEdgeBleach?: number

    visuals?: { [k: string]: boolean }
}

export class VolumeRepresentationComponent extends React.Component<VolumeRepresentationComponentProps, VolumeRepresentationComponentState> {
    state = this.stateFromRepresentation(this.props.representation)

    private stateFromRepresentation(repr: VolumeRepresentation<VolumeProps>) {
        return {
            label: repr.label,
            visible: repr.props.visible,
            alpha: repr.props.alpha,
            quality: repr.props.quality,
            colorTheme: repr.props.colorTheme,
            depthMask: repr.props.depthMask,

            flatShaded: (repr.props as any).flatShaded,
            resolutionFactor: (repr.props as any).resolutionFactor,
            radiusOffset: (repr.props as any).radiusOffset,
            smoothness: (repr.props as any).smoothness,
            pointSizeAttenuation: (repr.props as any).pointSizeAttenuation,
            pointFilledCircle: (repr.props as any).pointFilledCircle,
            pointEdgeBleach: (repr.props as any).pointEdgeBleach,

            visuals: (repr.props as any).visuals,
        }
    }

    componentWillMount() {
        this.setState(this.stateFromRepresentation(this.props.representation))
    }

    async update(state: Partial<VolumeRepresentationComponentState>) {
        const repr = this.props.representation
        const props: Partial<VolumeProps> = {}

        if (state.visible !== undefined) props.visible = state.visible
        if (state.quality !== undefined) props.quality = state.quality
        if (state.alpha !== undefined) props.alpha = state.alpha
        if (state.colorTheme !== undefined) props.colorTheme = state.colorTheme
        if (state.depthMask !== undefined) props.depthMask = state.depthMask

        if (state.flatShaded !== undefined) (props as any).flatShaded = state.flatShaded
        if (state.resolutionFactor !== undefined) (props as any).resolutionFactor = state.resolutionFactor
        if (state.radiusOffset !== undefined) (props as any).radiusOffset = state.radiusOffset
        if (state.smoothness !== undefined) (props as any).smoothness = state.smoothness
        if (state.pointSizeAttenuation !== undefined) (props as any).pointSizeAttenuation = state.pointSizeAttenuation
        if (state.pointFilledCircle !== undefined) (props as any).pointFilledCircle = state.pointFilledCircle
        if (state.pointEdgeBleach !== undefined) (props as any).pointEdgeBleach = state.pointEdgeBleach

        if (state.visuals !== undefined) (props as any).visuals = state.visuals

        await this.props.app.runTask(repr.createOrUpdate(props).run(
            progress => console.log(Progress.format(progress))
        ), 'Create/update representation')
        this.props.viewer.add(repr)
        this.props.viewer.draw(true)

        this.setState(this.stateFromRepresentation(repr))
    }

    render() {
        const { label, visible, quality, alpha, colorTheme, depthMask } = this.state
        const ct = ColorTheme(colorTheme)

        return <div>
            <div>
                <h4>{label}</h4>
            </div>
            <div>
                <div>
                    <span>Visible </span>
                    <button onClick={(e) => this.update({ visible: !visible }) }>
                        {visible ? 'Hide' : 'Show'}
                    </button>
                </div>
                { this.state.visuals !== undefined ? <div>
                    <span>Visuals: </span>
                    { Object.keys(this.state.visuals).map(k => {
                        return <span key={k}>{k} <input
                            type='checkbox'
                            checked={this.state.visuals[k]}
                            onChange={e => {
                                this.update({ visuals: { ...this.state.visuals, [k]: !!e.target.checked } })
                            }}
                        ></input> </span>
                    }) }
                </div> : '' }
                <div>
                    <span>Depth Mask </span>
                    <button onClick={(e) => this.update({ depthMask: !depthMask }) }>
                        {depthMask ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
                { this.state.flatShaded !== undefined ? <div>
                    <span>Flat Shaded </span>
                    <button onClick={(e) => this.update({ flatShaded: !this.state.flatShaded }) }>
                        {this.state.flatShaded ? 'Deactivate' : 'Activate'}
                    </button>
                </div> : '' }
                <div>
                    <span>Quality </span>
                    <select value={quality} onChange={e => this.update({ quality: e.target.value as VisualQuality }) }>
                        {VisualQualityNames.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                </div>
                <div>
                    <span>Opacity </span>
                    <input type='range'
                        defaultValue={alpha.toString()}
                        min='0'
                        max='1'
                        step='0.05'
                        onInput={e => this.update({ alpha: parseFloat(e.currentTarget.value) })}
                    >
                    </input>
                </div>
                { this.state.resolutionFactor !== undefined ? <div>
                    <span>Resolution Factor </span>
                    <input type='range'
                        defaultValue={this.state.resolutionFactor.toString()}
                        min='4'
                        max='9'
                        step='1'
                        onChange={(e) => this.update({ resolutionFactor: parseInt(e.currentTarget.value) })}
                    >
                    </input>
                </div> : '' }
                { this.state.smoothness !== undefined ? <div>
                    <span>Smoothness </span>
                    <input type='range'
                        defaultValue={this.state.smoothness.toString()}
                        min='1'
                        max='3'
                        step='0.1'
                        onChange={e => this.update({ smoothness: parseFloat(e.currentTarget.value) })}
                    >
                    </input>
                </div> : '' }
                { this.state.radiusOffset !== undefined ? <div>
                    <span>Radius Offset </span>
                    <input type='range'
                        defaultValue={this.state.radiusOffset.toString()}
                        min='0'
                        max='4'
                        step='0.1'
                        onChange={e => this.update({ radiusOffset: parseFloat(e.currentTarget.value) })}
                    >
                    </input>
                </div> : '' }
                { this.state.pointSizeAttenuation !== undefined ? <div>
                    <span>Size Attenuation </span>
                    <button onClick={e => this.update({ pointSizeAttenuation: !this.state.pointSizeAttenuation }) }>
                        {this.state.pointSizeAttenuation ? 'Deactivate' : 'Activate'}
                    </button>
                </div> : '' }
                { this.state.pointFilledCircle !== undefined ? <div>
                    <span>Filled Circle </span>
                    <button onClick={e => this.update({ pointFilledCircle: !this.state.pointFilledCircle }) }>
                        {this.state.pointFilledCircle ? 'Deactivate' : 'Activate'}
                    </button>
                </div> : '' }
                { this.state.pointEdgeBleach !== undefined ? <div>
                    <span>Edge Bleach </span>
                    <input type='range'
                        defaultValue={this.state.pointEdgeBleach.toString()}
                        min='0'
                        max='1'
                        step='0.05'
                        onInput={e => this.update({ pointEdgeBleach: parseFloat(e.currentTarget.value) })}
                    >
                    </input>
                </div> : '' }
                <div>
                    <span>Color Theme </span>
                    <select value={colorTheme.name} onChange={e => this.update({ colorTheme: { name: e.target.value as ColorThemeName } }) }>
                        {ColorThemeNames.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                    {ct.description ? <div><i>{ct.description}</i></div> : ''}
                    {
                        ct.legend && ct.legend.kind === 'scale-legend'
                            ? <div
                                style={{
                                    width: '100%',
                                    height: '30px',
                                    background: `linear-gradient(to right, ${ct.legend.colors.map(c => Color.toStyle(c)).join(', ')})`
                                }}
                            >
                                <span style={{float: 'left', padding: '6px', color: 'white', fontWeight: 'bold', backgroundColor: 'rgba(0, 0, 0, 0.2)'}}>{ct.legend.minLabel}</span>
                                <span style={{float: 'right', padding: '6px', color: 'white', fontWeight: 'bold', backgroundColor: 'rgba(0, 0, 0, 0.2)'}}>{ct.legend.maxLabel}</span>
                            </div>
                        : ct.legend && ct.legend.kind === 'table-legend'
                            ? <div>
                                {ct.legend.table.map((value, i) => {
                                    const [name, color] = value
                                    return <div key={i} style={{minWidth: '60px', marginRight: '5px', display: 'inline-block'}}>
                                        <div style={{width: '30px', height: '20px', backgroundColor: Color.toStyle(color), display: 'inline-block'}}></div>
                                        {name}
                                    </div>
                                })}
                            </div>
                        : ''
                    }
                </div>
            </div>
        </div>;
    }
}