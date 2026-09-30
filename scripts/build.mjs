/**
 * Bundle the pinned TUNER computation into dist/, with nothing left to install at run time.
 *
 * Three things are taken from `vendor/tuner` at the commit the submodule is pinned to, and never
 * copied by hand into src/:
 *   - the computation itself (esbuild follows `@/` through vendor/tuner's own tsconfig paths);
 *   - the drop-reason sentences, which live in a React component there (DropCensus.tsx `WHY`) and
 *     are lifted out of its source here as data, so this package never carries a second copy;
 *   - the practice BIN and practice drive, into samples/.
 *
 * The version and commit of that TUNER are stamped into the bundle, so every result can say which
 * calculation produced it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import ts from 'typescript';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const tuner = path.join(root, 'vendor', 'tuner');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (!fs.existsSync(path.join(tuner, 'src'))) {
    console.error('vendor/tuner is empty — run: git submodule update --init');
    process.exit(1);
}
const tunerPkg = JSON.parse(fs.readFileSync(path.join(tuner, 'package.json'), 'utf8'));
const tunerCommit = execFileSync('git', ['-C', tuner, 'rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['-C', tuner, 'status', '--porcelain'], { encoding: 'utf8' }).trim();
if (dirty) {
    // A bundle has to name a commit anyone can check out. Local edits in the submodule would ship
    // code that exists nowhere public.
    console.error('vendor/tuner has local changes; the bundle must come from a public commit:\n' + dirty);
    process.exit(1);
}

// --- the drop-reason sentences, lifted out of DropCensus.tsx -------------------------------------
function objectLiteral(node) {
    if (ts.isObjectLiteralExpression(node)) {
        const out = {};
        for (const p of node.properties) {
            if (!ts.isPropertyAssignment(p)) throw new Error('WHY: unexpected member ' + ts.SyntaxKind[p.kind]);
            out[p.name.getText().replace(/^['"]|['"]$/g, '')] = objectLiteral(p.initializer);
        }
        return out;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    throw new Error('WHY: a value that is not a plain string: ' + node.getText().slice(0, 60));
}
const censusFile = path.join(tuner, 'src', 'components', 'DropCensus.tsx');
const sf = ts.createSourceFile(censusFile, fs.readFileSync(censusFile, 'utf8'), ts.ScriptTarget.Latest, true);
let why = null;
sf.forEachChild(function walk(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText() === 'WHY' && n.initializer) why = objectLiteral(n.initializer);
    n.forEachChild(walk);
});
if (!why?.en || !why?.ja) throw new Error('WHY (en, ja) not found in DropCensus.tsx');
fs.mkdirSync(path.join(root, 'src', 'generated'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'generated', 'drop-why.json'), JSON.stringify(why, null, 2) + '\n');

// --- samples -------------------------------------------------------------------------------------
fs.mkdirSync(path.join(root, 'samples'), { recursive: true });
fs.copyFileSync(path.join(tuner, 'public', 'mock', 'csl-0401-community-patch-v1.partial.bin'), path.join(root, 'samples', 'practice.bin'));
fs.copyFileSync(path.join(tuner, 'scripts', 'fixtures', 'practice-drive.testo.csv'), path.join(root, 'samples', 'practice-drive.testo.csv'));

// --- bundle --------------------------------------------------------------------------------------
fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
const common = {
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    // Tells esbuild where `@/` points for files inside vendor/tuner: its own tsconfig does.
    absWorkingDir: root,
    define: {
        __PKG_VERSION__: JSON.stringify(pkg.version),
        __TUNER_VERSION__: JSON.stringify(tunerPkg.version),
        __TUNER_COMMIT__: JSON.stringify(tunerCommit),
    },
    // Some bundled CommonJS (papaparse and the MCP SDK's dependencies) calls require(); an ESM
    // bundle has none of its own.
    banner: { js: "import { createRequire as __matrixCreateRequire } from 'node:module'; const require = __matrixCreateRequire(import.meta.url);" },
    // Licences go into THIRD-PARTY-LICENSES.txt in full, below, rather than as fragments per bundle.
    legalComments: 'none',
    metafile: true,
    logLevel: 'warning',
};
const libBuild = await esbuild.build({ ...common, entryPoints: { index: 'src/index.ts', mapping: 'src/mapping.ts' }, outdir: 'dist', splitting: true, chunkNames: 'chunks/[name]-[hash]' });
const cliBuild = await esbuild.build({ ...common, entryPoints: { cli: 'src/cli.ts' }, outdir: 'dist', banner: { js: '#!/usr/bin/env node\n' + common.banner.js } });

// --- the licence of every package that ended up inside a bundle, in full --------------------------
// Read off esbuild's own record of what it bundled, so a dependency the SDK picks up next version is
// listed without anyone remembering to add it.
const bundled = new Map();
for (const input of [...Object.keys(libBuild.metafile.inputs), ...Object.keys(cliBuild.metafile.inputs)]) {
    const m = input.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
    if (m) bundled.set(m[1], path.join(root, 'node_modules', m[1]));
}
const licences = [...bundled.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, dir]) => {
    const p = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const file = fs.readdirSync(dir).find(f => /^(licen[sc]e|copying)(\.|$)/i.test(f));
    if (!file) throw new Error(`${name}: no licence file to reproduce`);
    return `${'='.repeat(100)}\n${name} ${p.version} — ${p.license}\n${p.homepage ?? p.repository?.url ?? ''}\n${'='.repeat(100)}\n\n${fs.readFileSync(path.join(dir, file), 'utf8').trim()}\n`;
});
const tunerLicence = fs.readFileSync(path.join(tuner, 'LICENSE'), 'utf8').trim();
fs.writeFileSync(path.join(root, 'THIRD-PARTY-LICENSES.txt'),
    'Licences of the code bundled into dist/. Generated by scripts/build.mjs from what esbuild bundled.\n\n'
    + `${'='.repeat(100)}\nMSS54HP CSL CONVERT /// TUNER ${tunerPkg.version} (${tunerCommit}) — MIT\nhttps://github.com/mushitaro/mss54hp-csl-convert-tuner\n${'='.repeat(100)}\n\n${tunerLicence}\n\n`
    + licences.join('\n'));

fs.writeFileSync(path.join(root, 'dist', 'provenance.json'), JSON.stringify({
    package: pkg.version,
    tuner: { repository: 'https://github.com/mushitaro/mss54hp-csl-convert-tuner', version: tunerPkg.version, commit: tunerCommit },
}, null, 2) + '\n');
console.log(`built matrix-tsunagi ${pkg.version} from TUNER ${tunerPkg.version} (${tunerCommit})`);
