/**
 * Copyright (c) 2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { Model } from 'mol-model/structure';
import { StructureQualityReport } from './properties/structure-quality-report';
// import { SymmetryAnnotation } from './properties/rcsb/symmetry';

export function attachModelProperties(model: Model): Promise<any>[] {
    // return a list of promises that start attaching the props in parallel
    // (if there are downloads etc.)
    return [
        StructureQualityReport.attachFromPDBeApi(model),
        // removed for now because of schema validation error
        // SymmetryAnnotation.attachFromRCSB(model)
    ];
}