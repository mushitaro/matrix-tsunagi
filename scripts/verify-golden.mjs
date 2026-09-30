/**
 * The tuned BIN this package makes is the one TUNER's DOWNLOAD TUNED makes — held to the app, not
 * to this package.
 *
 * GOLDEN is read out of the pinned TUNER commit (scripts/verify-file-workflow.mjs there), where it
 * was measured from the app itself: the production build in headless Chrome, the practice BIN and
 * practice drive set on UPLOAD BIN and TESTO CSV, the DOWNLOAD TUNED blob hashed. So when TUNER
 * re-measures after an intended change and the submodule moves, this compares against the new
 * value without anyone copying a hash across.
 *
 * Three paths are held to it: the library call, the CLI's --out, and the MCP server's out_path is
 * held in verify-mcp.mjs. And one control shows the comparison can fail — a single lambda value in
 * the drive moved must move the hash.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
let fails = 0;
const check = (n, c, d) => { console.log('  ' + (c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : ' — ' + (d ?? ''))); if (!c) fails++; };

const workflow = fs.readFileSync(path.join(root, 'vendor', 'tuner', 'scripts', 'verify-file-workflow.mjs'), 'utf8');
const GOLDEN = workflow.match(/const GOLDEN = '([0-9a-f]{64})'/)?.[1];
const provenance = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'provenance.json'), 'utf8'));
const pinned = execFileSync('git', ['-C', path.join(root, 'vendor', 'tuner'), 'rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();

console.log(`TUNER ${provenance.tuner.version} (${provenance.tuner.commit}), GOLDEN ${GOLDEN ?? '(none)'}`);
console.log('\n[the pin]');
check('the pinned TUNER commit carries a measured GOLDEN', !!GOLDEN);
check('dist/ was built from the commit vendor/tuner is pinned to', provenance.tuner.commit === pinned, `dist says ${provenance.tuner.commit}, the submodule is at ${pinned} — run npm run build`);
check('samples/ are the pinned commit\'s practice files, byte for byte',
    sha(fs.readFileSync(path.join(root, 'samples', 'practice.bin'))) === sha(fs.readFileSync(path.join(root, 'vendor', 'tuner', 'public', 'mock', 'csl-0401-community-patch-v1.partial.bin')))
    && sha(fs.readFileSync(path.join(root, 'samples', 'practice-drive.testo.csv'))) === sha(fs.readFileSync(path.join(root, 'vendor', 'tuner', 'scripts', 'fixtures', 'practice-drive.testo.csv'))));

const { mapping } = await import(pathToFileURL(path.join(root, 'dist', 'index.js')).href);
const bin = new Uint8Array(fs.readFileSync(path.join(root, 'samples', 'practice.bin')));
const csv = fs.readFileSync(path.join(root, 'samples', 'practice-drive.testo.csv'), 'utf8');

console.log('\n[pinned to the app]');
const lib = mapping.proposeVe({ bin, csv, fileName: 'practice-drive.testo.csv' });
check('library: proposeVe().tunedBin is what the app downloads', sha(lib.tunedBin) === GOLDEN, `got ${sha(lib.tunedBin)}`);

const out = path.join(os.tmpdir(), `matrix-tsunagi-golden-${process.pid}.bin`);
const cli = JSON.parse(execFileSync(process.execPath, [path.join(root, 'dist', 'cli.js'), 'mapping', 've', '--sample', '--out', out], { encoding: 'utf8' }));
const written = fs.readFileSync(out);
fs.rmSync(out);
check('CLI: the file --out writes is what the app downloads', sha(written) === GOLDEN, `got ${sha(written)}`);
check('CLI: the sha256 it reports is the file it wrote', cli.result.tunedBin?.sha256 === sha(written));

console.log('\n[the check can fail]');
// Bank 1's lambda trim raised 5 % in the one corner the practice drive rewrites (about 1100-1300 rpm,
// 2-3 % opening) and nowhere else. One row is not enough: hundreds of samples land in each cell and
// the table is stored at 1/1000, so a single sample rounds away — which is the calculation being
// right, not the check being blind. If the hash does not move for the corner, the comparison above
// was not looking at the calculation.
const lines = csv.split(/\r?\n/);
const sep = lines[0].includes(';') ? ';' : ',';
const header = lines[0].split(sep).map(h => h.trim().toLowerCase());
const col = header.indexOf('lambdaintegrator 1');
const rpmCol = header.indexOf('rpm');
const loadCol = header.indexOf('relativer oeffnungsquerschnitt');
let nudged = 0;
for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split(sep);
    if (Number(v[rpmCol]) > 1050 && Number(v[rpmCol]) < 1350 && Number(v[loadCol]) > 2 && Number(v[loadCol]) < 3) {
        v[col] = String(Number(v[col]) * 1.05);
        lines[i] = v.join(sep);
        nudged++;
    }
}
const moved = mapping.proposeVe({ bin, csv: lines.join('\n'), fileName: 'practice-drive.testo.csv' });
check(`control: bank 1 trim +5 % over ${nudged} rows of one corner moves the tuned BIN off the golden`, col >= 0 && nudged > 0 && sha(moved.tunedBin) !== GOLDEN);

console.log(fails ? `\n${fails} FAIL` : '\nall PASS');
process.exit(fails ? 1 : 0);
