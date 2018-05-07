/**
 * Copyright (c) 2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { ElementGroup, Element, Unit, Queries } from 'mol-model/structure';
import { StructureSizeDataProps } from '.';
import { createAttributeSize } from '../../../util/size-data';

/** Create attribute data with the size of an element, i.e. vdw for atoms and radius for coarse spheres */
export function elementSizeData(props: StructureSizeDataProps) {
    const { units, elementGroup, vertexMap } = props
    const unit = units[0]
    let radius: Element.Property<number>
    if (Unit.isAtomic(unit)) {
        radius = Queries.props.atom.vdw_radius
    } else if (Unit.isSpheres(unit)) {
        radius = Queries.props.coarse_grained.sphere_radius
    }
    const l = Element.Location()
    l.unit = unit
    return createAttributeSize({
        sizeFn: (elementIdx: number) => {
            l.element = ElementGroup.getAt(elementGroup, elementIdx)
            return radius(l)
        },
        vertexMap
    })
}