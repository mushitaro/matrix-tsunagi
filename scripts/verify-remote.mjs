/**
 * The remote MAPPING server, held to the local package — against any base URL.
 *
 *     npx wrangler dev --config remote/wrangler.jsonc --port 8799   (then)
 *     node scripts/verify-remote.mjs http://127.0.0.1:8799
 *     node scripts/verify-remote.mjs https://<the deployed host>
 *
 * Not part of `npm run verify`, because it needs a running server. Files are passed the way ChatGPT
 * passes them — an object with a download_url — pointing at the practice files in TUNER's public
 * repository at the pinned commit, so the remote path really downloads over https.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const base = process.argv[2];
if (!base) { console.error('usage: node scripts/verify-remote.mjs <base URL>'); process.exit(2); }
let fails = 0;
const check = (n, c, d) => { console.log('  ' + (c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : ' — ' + (d ?? ''))); if (!c) fails++; };

const { mapping } = await import(pathToFileURL(path.join(root, 'dist', 'index.js')).href);
const commit = execFileSync('git', ['-C', path.join(root, 'vendor', 'tuner'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const raw = `https://raw.githubusercontent.com/mushitaro/mss54hp-csl-convert-tuner/${commit}`;
const file = (p, n) => ({ download_url: raw + p, file_id: `file-${n}`, file_name: n });
const BIN = file('/public/mock/csl-0401-community-patch-v1.partial.bin', 'practice.bin');
const LOG = file('/scripts/fixtures/practice-drive.testo.csv', 'practice-drive.testo.csv');

const c = new Client({ name: 'verify-remote', version: '0' });
await c.connect(new StreamableHTTPClientTransport(new URL(base.replace(/\/$/, '') + '/mcp/mapping')));
const call = async (name, args) => { const r = await c.callTool({ name, arguments: args }); return { err: r.isError === true, body: JSON.parse(r.content[0].text) }; };

console.log(`[${base}]`);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
check('it is this package\'s version', c.getServerVersion()?.version === pkg.version, JSON.stringify(c.getServerVersion()));
const { tools } = await c.listTools();
const fp = Object.fromEntries(tools.map(t => [t.name, t._meta?.['openai/fileParams'] ?? []]));
check('MAPPING\'s tools, and no MIGRATION tool (its dumps carry a VIN and stay local)',
    JSON.stringify(Object.keys(fp).sort()) === JSON.stringify(['about_matrix', 'propose_rfkorr', 'propose_ve', 'read_bin', 'read_log', 'smg2_compare', 'smg2_image', 'smg2_read']), Object.keys(fp).join(', '));
check('every file input is declared as an openai/fileParams field', ['read_bin', 'read_log', 'propose_ve', 'propose_rfkorr', 'smg2_image', 'smg2_read', 'smg2_compare'].every(t => fp[t].length > 0));
check('every tool is read-only', tools.every(t => t.annotations?.readOnlyHint === true));

const local = mapping.proposeVe({
    bin: new Uint8Array(fs.readFileSync(path.join(root, 'samples', 'practice.bin'))),
    csv: fs.readFileSync(path.join(root, 'samples', 'practice-drive.testo.csv'), 'utf8'),
    fileName: 'practice-drive.testo.csv',
});
const viaFiles = await call('propose_ve', { bin_file: BIN, log_file: LOG });
check('propose_ve with downloaded files: the local package\'s table, cell for cell',
    !viaFiles.err && JSON.stringify(viaFiles.body.result.table) === JSON.stringify(local.result.table) && viaFiles.body.summary === local.summary,
    viaFiles.err ? viaFiles.body.error : 'tables or summaries differ');
check('and no file comes back — the free app makes it', typeof viaFiles.body.result?.tunedBin === 'string' && /mss54hp-csl-convert-tuner\.tsunagi\.app/.test(viaFiles.body.result.tunedBin));
const viaSample = await call('propose_ve', { use_sample: true });
check('use_sample gives the same', JSON.stringify(viaSample.body.result?.table) === JSON.stringify(local.result.table));
const rf = await call('propose_rfkorr', { bin_file: BIN, log_file: LOG });
check('propose_rfkorr: experimental, pointing at the WORKS build', rf.body.source?.stage === 'experimental' && rf.body.apply?.availability === 'works');

const http = await call('read_bin', { bin_file: { download_url: 'http://example.com/x.bin', file_id: 'x' } });
check('a plain-http URL is refused', http.err && /https/.test(http.body.error));
const gone = await call('read_bin', { bin_file: file('/no/such/file.bin', 'x') });
check('an expired link says to attach the file again', gone.err && /attach it again/.test(gone.body.error));
const none = await call('read_bin', {});
check('no file at all says to attach one', none.err && /Attach the BIN/.test(none.body.error));
await c.close();

console.log(fails ? `\n${fails} FAIL` : '\nall PASS');
process.exit(fails ? 1 : 0);
