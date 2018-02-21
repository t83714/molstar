/**
 * Copyright (c) 2017 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import * as util from 'util'
import * as fs from 'fs'

require('util.promisify').shim();
const readFileAsync = util.promisify(fs.readFile);

import Gro from 'mol-io/reader/gro/parser'
import Csv from 'mol-io/reader/csv/parser'
import CIF from 'mol-io/reader/cif'

import Computation from 'mol-util/computation'

import { Model } from 'mol-model/structure'

const file = '1crn.gro'
// const file = 'water.gro'
// const file = 'test.gro'
// const file = 'md_1u19_trj.gro'

function showProgress(tag: string, p: Computation.Progress) {
    console.log(`[${tag}] ${p.message} ${p.isIndeterminate ? '' : (p.current / p.max * 100).toFixed(2) + '% '}(${p.elapsedMs | 0}ms)`)
}

async function runGro(input: string) {
    console.time('parseGro');
    const comp = Gro(input);

    const ctx = Computation.observable({ updateRateMs: 150, observer: p => showProgress('GRO', p) });
    const parsed = await comp(ctx);
    console.timeEnd('parseGro');

    if (parsed.isError) {
        console.log(parsed);
        return;
    }

    const groFile = parsed.result

    console.log('structure count: ', groFile.structures.length);

    const data = groFile.structures[0];

    // const header = groFile.blocks[0].getCategory('header')
    const { header, atoms } = data;
    console.log(JSON.stringify(header, null, 2));
    console.log('number of atoms:', atoms.count);

    console.log(`'${atoms.residueNumber.value(1)}'`)
    console.log(`'${atoms.residueName.value(1)}'`)
    console.log(`'${atoms.atomName.value(1)}'`)
    console.log(atoms.z.value(1))
    console.log(`'${atoms.z.value(1)}'`)

    const n = atoms.count;
    console.log('rowCount', n)

    console.time('getFloatArray x')
    const x = atoms.x.toArray({ array: Float32Array })
    console.timeEnd('getFloatArray x')
    console.log(x.length, x[0], x[x.length - 1])

    console.time('getFloatArray y')
    const y = atoms.y.toArray({ array: Float32Array })
    console.timeEnd('getFloatArray y')
    console.log(y.length, y[0], y[y.length - 1])

    console.time('getFloatArray z')
    const z = atoms.z.toArray({ array: Float32Array })
    console.timeEnd('getFloatArray z')
    console.log(z.length, z[0], z[z.length - 1])

    console.time('getIntArray residueNumber')
    const residueNumber = atoms.residueNumber.toArray({ array: Int32Array })
    console.timeEnd('getIntArray residueNumber')
    console.log(residueNumber.length, residueNumber[0], residueNumber[residueNumber.length - 1])
}

export async function _gro() {
    const input = await readFileAsync(`./examples/${file}`, 'utf8')
    runGro(input)
}

// _gro()

async function runCIF(input: string | Uint8Array) {
    console.time('parseCIF');
    const comp = typeof input === 'string' ? CIF.parseText(input) : CIF.parseBinary(input);

    const ctx = Computation.observable({ updateRateMs: 250, observer: p => showProgress('CIF', p) });
    const parsed = await comp(ctx);
    console.timeEnd('parseCIF');
    if (parsed.isError) {
        console.log(parsed);
        return;
    }

    const data = parsed.result.blocks[0];
    const atom_site = data.categories._atom_site;
    console.log(atom_site.getField('Cartn_x')!.float(0));
    //console.log(atom_site.getField('label_atom_id')!.toStringArray());

    const mmcif = CIF.schema.mmCIF(data);
    console.log(mmcif.atom_site.Cartn_x.value(0));
    console.log(mmcif.entity.type.toArray());
    console.log(mmcif.pdbx_struct_oper_list.matrix.value(0));

    console.time('createModels');
    const models = Model.create({ kind: 'mmCIF', data: mmcif });
    console.timeEnd('createModels');

    for (let i = 0; i < models.length; i++) {
        console.log(models[i].id, models[i].conformation.id);
    }

    // console.log(models[0].hierarchy.isMonotonous);
    // console.log(models[0].hierarchy.atoms.type_symbol.value(0));
    // console.log(models[0].hierarchy.residues.auth_comp_id.value(0));
    // console.log(models[0].hierarchy.residues.auth_comp_id.value(1));
    // console.log(models[0].hierarchy.chains.auth_asym_id.value(0));
    // console.log(models[0].hierarchy.chains.auth_asym_id.value(1));
    // console.log(models[0].hierarchy.chains.label_asym_id.value(1));
    // console.log(models[0].conformation.x[0]);
    // console.log(models[0].conformation.y[0]);
    // console.log(models[0].conformation.z[0]);

    // const schema = await _dic()
    // if (schema) {
    //     const mmcif2 = applySchema(schema, data)
    //     // console.log(util.inspect(mmcif2.atom_site, {showHidden: false, depth: 3}))
    //     console.log(mmcif2.atom_site.Cartn_x.value(0));
    //     console.log(mmcif2.entity.type.toArray());
    //     // console.log(mmcif2.pdbx_struct_oper_list.matrix.value(0)); // TODO
    // } else {
    //     console.log('error getting mmcif schema from dic')
    // }
}

export async function _cif() {
    let path = `./examples/1grm_updated.cif`;
    // path = '../test/3j3q.cif'  // lets have a relative path for big test files
    // path = 'e:/test/quick/3j3q_updated.cif';
    const input = await readFileAsync(path, 'utf8')
    console.log('------------------');
    console.log('Text CIF:');
    runCIF(input);

    path = `./examples/1cbs_full.bcif`;

    const input2 = await readFileAsync(path)
    console.log('------------------');
    console.log('BinaryCIF:');
    const data = new Uint8Array(input2.byteLength);
    for (let i = 0; i < input2.byteLength; i++) data[i] = input2[i];
    runCIF(input2);
}

// _cif();

const comp = Computation.create(async ctx => {
    for (let i = 0; i < 0; i++) {
        await new Promise(res => setTimeout(res, 500));
        if (ctx.requiresUpdate) await ctx.update({ message: 'working', current: i, max: 2 });
    }
    return 42;
});
export async function testComp() {
    const ctx = Computation.observable({ observer: p => showProgress('test', p) });
    const ret = await comp(ctx);
    console.log('computation returned', ret);
}
// testComp();


const csvString = ` Year,Make,Model,Length
1997,Ford,"E350

MOIN",2.34
2000,Mercury, Cougar,2.38`

export async function testCsv () {
    const parsed = await Csv(csvString)();

    if (parsed.isError) {
        console.log(parsed)
        return;
    }

    const csvFile = parsed.result;
    csvFile.table.columnNames.forEach(name => {
        const col = csvFile.table.getColumn(name)
        if (col) console.log(name, col.toStringArray())
    })

    const year = csvFile.table.getColumn('Year')
    if (year) console.log('(int)Year', year.toIntArray())

    const length = csvFile.table.getColumn('Length')
    if (length) console.log('(float)Length', length.toFloatArray())
}
testCsv()