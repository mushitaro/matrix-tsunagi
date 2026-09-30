/**
 * The line this package keeps, and the words it hands an assistant to repeat.
 *
 *   - Only what the free public app also writes comes out as a file (the VE map). A WORKS-only
 *     calculation returns values and evidence, never a file — the WORKS build makes that
 *     (operator, 2026-09-30).
 *   - Every experimental result says so, in both languages.
 *   - `apply` appears only on results that would have to be written to the car.
 *   - The relayed words stay true when paraphrased: MILE is one-time, and a MILESTONE is a wish on
 *     record, never a promise of a release (terms of service §3).
 *   - Nothing reaches the network, and the CSV parser is the version the app locks.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
let fails = 0;
const check = (n, c, d) => { console.log('  ' + (c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : ' — ' + (d ?? ''))); if (!c) fails++; };

const lib = await import(pathToFileURL(path.join(root, 'dist', 'index.js')).href);
const { mapping, ABOUT } = lib;
const bin = new Uint8Array(fs.readFileSync(path.join(root, 'samples', 'practice.bin')));
const csv = fs.readFileSync(path.join(root, 'samples', 'practice-drive.testo.csv'), 'utf8');

console.log('[files only where the free app makes them]');
const ve = mapping.proposeVe({ bin, csv });
const rf = mapping.proposeRfKorr({ bin, csv });
check('ve (stable) carries the tuned BIN', ve.tunedBin instanceof Uint8Array && ve.tunedBin.byteLength === 65536);
check('rfkorr (WORKS-only) carries no file of any kind',
    !JSON.stringify(Object.keys(rf)).includes('Bin') && !Object.values(rf).some(v => v instanceof Uint8Array)
    && !Object.values(rf.result ?? {}).some(v => v instanceof Uint8Array));
const out = path.join(os.tmpdir(), `matrix-tsunagi-line-${process.pid}.bin`);
const r = spawnSync(process.execPath, [path.join(root, 'dist', 'cli.js'), 'mapping', 'rfkorr', '--sample', '--out', out], { encoding: 'utf8' });
check('CLI refuses --out for rfkorr, and writes nothing', r.status === 1 && !fs.existsSync(out), `exit ${r.status}`);
check('... and says where the file is made instead', /WORKS build/.test(r.stderr) && /m3\.tsunagi\.app\/en\/mesh/.test(r.stderr));

console.log('\n[stage and apply]');
check('ve: stable, apply = the free public TUNER',
    ve.source.stage === 'stable' && ve.apply?.availability === 'free' && ve.apply.url === 'https://mss54hp-csl-convert-tuner.tsunagi.app/');
check('rfkorr: experimental, with the note in English and Japanese',
    rf.source.stage === 'experimental' && !!rf.source.note?.en && !!rf.source.note?.ja);
check('rfkorr: apply = WORKS, pointing at MESH', rf.apply?.availability === 'works' && /\/mesh$/.test(rf.apply.url));
check('bin and log carry no apply — nothing there is written to a car',
    !('apply' in mapping.readBin({ bin })) && !('apply' in mapping.readLog({ csv, bin })));
for (const [name, env] of [['ve', ve], ['rfkorr', rf]]) {
    check(`${name}: apply.how in both languages`, !!env.apply?.how?.en && !!env.apply?.how?.ja);
}

console.log('\n[words an assistant repeats]');
const smg2 = mapping.smg2Image({ image: new Uint8Array(0x80000) });
const said = [
    ...ABOUT.en, ...ABOUT.ja,
    ve.apply.how.en, ve.apply.how.ja, rf.apply.how.en, rf.apply.how.ja, smg2.apply.how.en, smg2.apply.how.ja,
].join('\n');
// SMG2's WORKS build never writes to the gearbox ECU (its README, "書き込みが無い理由"), so what it is
// said to do must not include writing to the car.
check('SMG2 is never said to write to the car', !/write|writing|written/i.test(smg2.apply.how.en) && !/書き込/.test(smg2.apply.how.ja), smg2.apply.how.en);
check('SMG2 results point at its WORKS build', smg2.apply.availability === 'works' && /E46M3SMG2/.test(smg2.apply.app));
check('MILE is described as one-time, in both languages', /one-time payment/.test(ABOUT.en.join(' ')) && /一回限り/.test(ABOUT.ja.join(' ')));
check('the MILESTONE sentence says it is not a promise, in both languages',
    /not a promise of any release or date/.test(ABOUT.en.join(' ')) && /約束するものではありません/.test(ABOUT.ja.join(' ')));
const forbidden = ['when enough', 'once enough', 'will be released', 'will ship', 'guarantee', 'subscribe', 'monthly', '集まれば', '本番公開', '保証', '月額', 'サブスク'];
const hit = forbidden.filter(w => said.toLowerCase().includes(w.toLowerCase()));
check('no phrase that turns a MILESTONE into a promise, or MILE into a subscription', hit.length === 0, hit.join(', '));

console.log('\n[nothing leaves the machine]');
const bundles = [path.join(root, 'dist', 'cli.js'), ...fs.readdirSync(path.join(root, 'dist', 'chunks')).filter(f => f.endsWith('.js')).map(f => path.join(root, 'dist', 'chunks', f))];
const netApi = /\bfetch\(|XMLHttpRequest|https?\.request\(|new WebSocket\(|net\.connect\(|dgram\./g;
const stray = [];
for (const f of bundles) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(netApi)) {
        // papaparse's NetworkStreamer (download: true) is bundled but never reached: TUNER's parser
        // hands it a string, and Node has no XMLHttpRequest to begin with.
        const before = s.slice(Math.max(0, m.index - 1500), m.index);
        if (m[0] === 'XMLHttpRequest' && /function NetworkStreamer\(/.test(before)) continue;
        stray.push(`${path.basename(f)}@${m.index}: ${m[0]}`);
    }
}
check('no network call in the bundles', stray.length === 0, stray.join('; '));
const parserSrc = fs.readFileSync(path.join(root, 'vendor', 'tuner', 'src', 'lib', 'log-engine', 'parser.ts'), 'utf8');
check('TUNER\'s parser never asks papaparse to download', !/download\s*:\s*true/.test(parserSrc));

console.log('\n[the app\'s parser, not a neighbour of it]');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'vendor', 'tuner', 'package-lock.json'), 'utf8'));
const want = lock.packages['node_modules/papaparse']?.version;
const have = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'papaparse', 'package.json'), 'utf8')).version;
check(`papaparse is the version TUNER locks (${want})`, want === have, `bundled ${have}`);

console.log('\n[the registry entry names this package]');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const server = JSON.parse(fs.readFileSync(path.join(root, 'server.json'), 'utf8'));
check('server.json name is package.json mcpName (the registry\'s ownership proof)', server.name === pkg.mcpName);
check('server.json, its npm package entry and package.json carry one version',
    server.version === pkg.version && server.packages?.[0]?.version === pkg.version && server.packages?.[0]?.identifier === pkg.name,
    `${server.version} / ${server.packages?.[0]?.version} / ${pkg.version}`);
check('server.json description fits the registry (100 characters)', server.description.length <= 100, `${server.description.length}`);

console.log(fails ? `\n${fails} FAIL` : '\nall PASS');
process.exit(fails ? 1 : 0);
