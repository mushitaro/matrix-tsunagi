/**
 * SMG2's reading, held to the app's own.
 *
 * There is no app-measured golden for SMG2 the way TUNER has one: the app decodes, it does not hand
 * back a file to hash. What can drift is the composition — src/mapping/smg2.ts re-composes the
 * app's `loadDefinition` because the app fetches the definition and this takes it from a path. So
 * the check runs the APP'S `loadDefinition` (vendor/smg2/src/lib/definitions.ts, fetch answered
 * with the same XDF text) beside this package's, and compares every item's decoded raw values and
 * every validator finding.
 *
 * That needs two things that are not public: the MS4X XDFs and an image read from a car. They live
 * in the SMG2 working copy (SMG2_PRIVATE, default ../E46M3SMG2_TuningTool). Without them those checks
 * print SKIP — which is not PASS; run them with the files present before trusting a change here.
 * What needs neither runs everywhere.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
let fails = 0;
let skips = 0;
const check = (n, c, d) => { console.log('  ' + (c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : ' — ' + (d ?? ''))); if (!c) fails++; };
const skip = (n, why) => { console.log(`  SKIP  ${n} — ${why}`); skips++; };

const { mapping } = await import(pathToFileURL(path.join(root, 'dist', 'index.js')).href);
const cli = (...args) => spawnSync(process.execPath, [path.join(root, 'dist', 'cli.js'), ...args], { encoding: 'utf8' });

// --- both implementations, bundled from source for this check only -------------------------------
const entry = path.join(os.tmpdir(), `matrix-smg2-entry-${process.pid}.ts`);
const bundle = path.join(os.tmpdir(), `matrix-smg2-bundle-${process.pid}.mjs`);
fs.writeFileSync(entry, [
    `export { loadXdf, decodeAll, identify, buildPracticeImage, PRACTICE_IDENTITY } from ${JSON.stringify(path.join(root, 'src', 'mapping', 'smg2.ts'))};`,
    `export { loadDefinition } from ${JSON.stringify(path.join(root, 'vendor', 'smg2', 'src', 'lib', 'definitions.ts'))};`,
    `export { decodeItem } from ${JSON.stringify(path.join(root, 'vendor', 'smg2', 'packages', 'xdf-engine', 'src', 'index.ts'))};`,
].join('\n'));
await esbuild.build({
    entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', absWorkingDir: root,
    tsconfig: path.join(root, 'tsconfig.json'), logLevel: 'error',
    banner: { js: "import { createRequire as __c } from 'node:module'; const require = __c(import.meta.url);" },
});
const both = await import(pathToFileURL(bundle).href);
fs.rmSync(entry); fs.rmSync(bundle);

console.log('[the pin]');
const provenance = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'provenance.json'), 'utf8'));
const pinned = spawnSync('git', ['-C', path.join(root, 'vendor', 'smg2'), 'rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
check('dist/ was built from the commit vendor/smg2 is pinned to', provenance.smg2?.commit === pinned, `dist says ${provenance.smg2?.commit}, the submodule is at ${pinned}`);

console.log('\n[no private files needed]');
const practice = both.buildPracticeImage();
const id = mapping.smg2Image({ image: practice, practice: true });
check('the practice image is a full read', id.result.variant === 'full-512k');
check(`its ZB is the practice identity (${both.PRACTICE_IDENTITY.zbNumber})`, id.result.zb === both.PRACTICE_IDENTITY.zbNumber, id.result.zb);
check('its calibration checksum holds', id.result.checksums.some(c => c.area === 'calibration' && c.ok));
check('the result says it is PRACTICE, first', id.summary.startsWith('PRACTICE'));
check('smg2 results point at the WORKS build via MESH and carry no file',
    id.apply?.availability === 'works' && /\/mesh$/.test(id.apply.url) && !Object.values(id).some(v => v instanceof Uint8Array));
const noXdf = cli('mapping', 'smg2', 'read', '--sample');
check('read without an XDF says what is needed, and where the WORKS build has it', noXdf.status === 1 && /--xdf/.test(noXdf.stderr) && /WORKS build/.test(noXdf.stderr) && /mesh/.test(noXdf.stderr));
const odd = new Uint8Array(1000);
const oddId = mapping.smg2Image({ image: odd });
check('an image of another length is named as such, not guessed at', oddId.result.variant === null && /1,000 bytes/.test(oddId.summary));

// --- the private files ---------------------------------------------------------------------------
const priv = process.env.SMG2_PRIVATE ?? path.join(root, '..', 'E46M3SMG2_TuningTool');
const xdfPath = (v) => [path.join(priv, 'packages', 'xdf-engine', 'fixtures', `Siemens_SMG_II_510_${v}.xdf`), path.join(priv, 'public', 'xdf', `Siemens_SMG_II_510_${v}.xdf`)].find(p => fs.existsSync(p));
const extractions = path.join(priv, 'data', 'extractions');
const realImages = fs.existsSync(extractions)
    ? fs.readdirSync(extractions).filter(f => f.endsWith('.bin') && !f.startsWith('PRACTICE_')).map(f => path.join(extractions, f))
    : [];

console.log('\n[held to the app\'s own loadDefinition]');
const XDF = { 'partial-24k': xdfPath('24K'), 'full-512k': xdfPath('512K') };
if (!XDF['partial-24k'] || !XDF['full-512k'] || !realImages.length) {
    skip('decode equivalence on a real image', `needs the two MS4X XDFs and a car's image under ${priv}`);
} else {
    const text = Object.fromEntries(Object.entries(XDF).map(([v, p]) => [v, fs.readFileSync(p, 'utf8')]));
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
        const v = /24K/.test(url) ? 'partial-24k' : /512K/.test(url) ? 'full-512k' : null;
        return v ? { ok: true, status: 200, text: async () => text[v] } : { ok: false, status: 404, text: async () => '' };
    };
    const decodedByImage = new Map();
    for (const file of realImages) {
        const image = new Uint8Array(fs.readFileSync(file));
        const variant = both.identify(image).variant;
        if (!variant) { skip(path.basename(file), 'not a window or a full read'); continue; }
        const ours = both.loadXdf(text[variant], variant);
        const app = await both.loadDefinition(variant);
        check(`${path.basename(file)} (${variant}): the same items in the same order`,
            JSON.stringify(ours.definition.items.map(i => i.uniqueId)) === JSON.stringify(app.definition.items.map(i => i.uniqueId)));
        check(`${path.basename(file)}: the same validator findings`,
            JSON.stringify(ours.findings) === JSON.stringify(app.findings), `${ours.findings.length} here, ${app.findings.length} in the app`);
        const mine = both.decodeAll(ours, image);
        const differ = [];
        mine.forEach((e, i) => {
            const theirs = both.decodeItem(app.definition, image, app.definition.items[i]);
            if (JSON.stringify(e.decoded?.raw) !== JSON.stringify(theirs.raw)
                || JSON.stringify(e.decoded?.kind === 'constant' ? e.decoded.value : e.decoded?.values) !== JSON.stringify(theirs.kind === 'constant' ? theirs.value : theirs.values)) differ.push(e.item.title);
        });
        check(`${path.basename(file)}: all ${mine.length} items decode to the app's raw and physical values`, differ.length === 0, differ.slice(0, 5).join('; '));
        decodedByImage.set(file, { variant, mine });

        // The control: one byte inside a shift map, moved. The app's reading of the original has to
        // disagree with this package's reading of the moved image.
        const target = app.definition.items.find(i => i.title === 'AUTO: A1 Speed Thresholds')
            ?? app.definition.items.find(i => i.kind === 'table' && i.z.data.rows > 1);
        const at = app.definition.fileOffsetOf(target.z.data.address);
        const moved = Uint8Array.from(image); moved[at] ^= 0x01;
        const theirsOriginal = both.decodeItem(app.definition, image, target);
        const minesMoved = both.decodeAll(ours, moved).find(e => e.item.uniqueId === target.uniqueId);
        check(`${path.basename(file)}: control — one bit of "${target.title}" moved is seen as a difference`,
            JSON.stringify(minesMoved.decoded.raw) !== JSON.stringify(theirsOriginal.raw));
        const cmp = mapping.smg2Compare({ image, other: moved, xdf: text[variant] });
        check(`${path.basename(file)}: compare finds exactly that item, one cell`,
            cmp.result.differs.length >= 1 && cmp.result.differs.some(d => d.uniqueId === target.uniqueId && d.cellsChanged === 1),
            JSON.stringify(cmp.result.differs.map(d => [d.title, d.cellsChanged])));
        check(`${path.basename(file)}: compare against itself finds nothing`, mapping.smg2Compare({ image, other: image, xdf: text[variant] }).result.differs.length === 0);
        const other = variant === 'partial-24k' ? 'full-512k' : 'partial-24k';
        let refused = false;
        try { mapping.smg2Read({ image, xdf: text[other] }); } catch (e) { refused = /other variant/.test(e.message); }
        check(`${path.basename(file)}: the other variant's XDF is refused, not read at the wrong offset`, refused);
    }
    globalThis.fetch = realFetch;

    // A window read and a full read of the same car should agree item by item. Reported, not
    // asserted: that is a fact about the two reads, not about this code.
    const w = [...decodedByImage.values()].find(d => d.variant === 'partial-24k');
    const f = [...decodedByImage.values()].find(d => d.variant === 'full-512k');
    if (w && f) {
        const disagree = w.mine.filter((e, i) => JSON.stringify(e.decoded?.raw) !== JSON.stringify(f.mine[i].decoded?.raw)).map(e => e.item.title);
        console.log(`  info  the window read and the full read disagree on ${disagree.length} item(s)${disagree.length ? ': ' + disagree.slice(0, 5).join('; ') : ''}`);
    }
}

console.log(fails ? `\n${fails} FAIL` : skips ? `\nall PASS, ${skips} SKIP (not a pass: run with the private files present)` : '\nall PASS');
process.exit(fails ? 1 : 0);
