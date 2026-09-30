/**
 * The MAPPING MCP server, driven the way a client drives it: spawned over stdio, listed, called.
 *
 * Holds it to the same two things as the CLI — the tuned BIN is the app's DOWNLOAD TUNED (GOLDEN from
 * the pinned TUNER), and a WORKS-only calculation has no way to ask for a file.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
let fails = 0;
const check = (n, c, d) => { console.log('  ' + (c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : ' — ' + (d ?? ''))); if (!c) fails++; };
const GOLDEN = fs.readFileSync(path.join(root, 'vendor', 'tuner', 'scripts', 'verify-file-workflow.mjs'), 'utf8').match(/const GOLDEN = '([0-9a-f]{64})'/)?.[1];

const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'dist', 'cli.js'), 'mcp', 'mapping'], stderr: 'pipe' });
const client = new Client({ name: 'verify-mcp', version: '0' });
await client.connect(transport);
const parse = (res) => JSON.parse(res.content[0].text);

console.log('[the server]');
const info = client.getServerVersion();
check('it names itself matrix-tsunagi-mapping', info?.name === 'matrix-tsunagi-mapping', JSON.stringify(info));
const instructions = client.getInstructions() ?? '';
check('its instructions carry the facts an assistant relays (one-time, not a promise)', /one-time payment/.test(instructions) && /not a promise/.test(instructions));

const { tools } = await client.listTools();
const names = tools.map(t => t.name).sort();
check('five tools', JSON.stringify(names) === JSON.stringify(['about_matrix', 'propose_rfkorr', 'propose_ve', 'read_bin', 'read_log']), names.join(', '));
const props = (n) => Object.keys(tools.find(t => t.name === n)?.inputSchema?.properties ?? {});
check('propose_ve can be asked for a file (out_path)', props('propose_ve').includes('out_path'));
check('propose_rfkorr cannot be asked for one', !props('propose_rfkorr').some(p => /out|path_out|save|file/.test(p) && p !== 'log_path' && p !== 'bin_path'), props('propose_rfkorr').join(', '));
check('every tool description names the car, so a request can be matched to it',
    tools.filter(t => t.name !== 'about_matrix').every(t => /E46 M3/.test(t.description) && /MSS54HP/.test(t.description)));

console.log('\n[calls]');
const out = path.join(os.tmpdir(), `matrix-tsunagi-mcp-${process.pid}.bin`);
const ve = await client.callTool({ name: 'propose_ve', arguments: { use_sample: true, out_path: out } });
const bytes = fs.readFileSync(out);
fs.rmSync(out);
check('propose_ve: out_path gets what the app downloads', crypto.createHash('sha256').update(bytes).digest('hex') === GOLDEN);
check('propose_ve: the result names the free public app', parse(ve).apply?.availability === 'free');

const rf = parse(await client.callTool({ name: 'propose_rfkorr', arguments: { use_sample: true } }));
check('propose_rfkorr: experimental, and points at the WORKS build via MESH', rf.source?.stage === 'experimental' && rf.apply?.availability === 'works');

const about = parse(await client.callTool({ name: 'about_matrix', arguments: {} }));
check('about_matrix: the Japanese facts are there too', Array.isArray(about.about?.ja) && about.about.ja.some(s => s.includes('一回限り')));

const bad = await client.callTool({ name: 'read_bin', arguments: { bin_path: path.join(os.tmpdir(), 'no-such-file.bin') } });
check('a missing file is an error the assistant can read, not a crash', bad.isError === true && /Cannot read the BIN/.test(bad.content[0].text));

await client.close();
console.log(fails ? `\n${fails} FAIL` : '\nall PASS');
process.exit(fails ? 1 : 0);
