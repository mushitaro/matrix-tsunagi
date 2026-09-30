/**
 * MIGRATION: read only, and nothing personal in what it says.
 *
 *   - The functions that BUILD a changed image (an odometer or VIN written into an M35080, a CSL
 *     bootloader patched into a DME) are not in the published bundles at all.
 *   - A result never carries the VIN or the DME's identity record. Checked with the real needle: the
 *     VIN the practice EEPROM carries and the identity text the practice DME carries are found in the
 *     INPUT bytes first, so a check that cannot find them anywhere is not passing by accident.
 *   - The readings match what the apps' own practice builders put there, and each result points at
 *     the WORKS build, never saying BOOT writes.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
let fails = 0;
const check = (n, c, d) => { console.log('  ' + (c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : ' — ' + (d ?? ''))); if (!c) fails++; };

const mig = await import(pathToFileURL(path.join(root, 'dist', 'migration.js')).href);

// The apps' own helpers for the needles, bundled for this check only.
const entry = path.join(os.tmpdir(), `matrix-mig-entry-${process.pid}.ts`);
const bundle = path.join(os.tmpdir(), `matrix-mig-bundle-${process.pid}.mjs`);
fs.writeFileSync(entry, [
    `export { identityText, extractServiceBlock } from ${JSON.stringify(path.join(root, 'vendor', 'boot', 'packages', 'dme-flash', 'src', 'fastEntry.ts'))};`,
    `export { readVins } from ${JSON.stringify(path.join(root, 'vendor', 'm35080', 'web', 'lib', 'domain', 'vin.ts'))};`,
].join('\n'));
await esbuild.build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', absWorkingDir: root, tsconfig: path.join(root, 'tsconfig.json'), logLevel: 'error' });
const apps = await import(pathToFileURL(bundle).href);
fs.rmSync(entry); fs.rmSync(bundle);

console.log('[the builders of changed images are not shipped]');
const shipped = ['index.js', 'mapping.js', 'migration.js', 'cli.js', ...fs.readdirSync(path.join(root, 'dist', 'chunks')).map(f => `chunks/${f}`)]
    .filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(root, 'dist', f), 'utf8')).join('\n');
const writers = ['encodeOdometer', 'planOdometerWrite', 'planSlotWrites', 'recomputeChecksums', 'encodeCodedVin', 'encodeVin', 'planCoding', 'planJob', 'savedImage', 'applyBytes', 'patchToCsl', 'buildConversionImage', 'buildVariant'];
const present = writers.filter(w => new RegExp(`\\bfunction ${w}\\b`).test(shipped));
check('none of the image-changing functions is in dist/', present.length === 0, present.join(', '));
check('control: the scan does find a function that IS shipped (decodeOdometer)', /\bfunction decodeOdometer\b/.test(shipped));

console.log('\n[BOOT, on its practice image]');
const dme = mig.practiceEcuImage();
const boot = mig.bootBackup({ image: dme, practice: true });
check('both processors read as the standard M3 bootloader, CRCs holding', boot.result.master.flavour === 'standard-m3' && boot.result.slave.flavour === 'standard-m3' && boot.result.master.crc.valid && boot.result.slave.crc.valid);
check('the program number is the practice one (21132300)', boot.result.master.programNumbers.every(p => p === '21132300'));
check('two stages left, slave first', boot.result.conversion.total === 2 && boot.result.conversion.next === 'slave');
const identity = apps.identityText(apps.extractServiceBlock(dme, 'master'));
check('control: the practice DME does carry an identity record to leak', identity.length >= 3, JSON.stringify(identity));
check('the identity record is nowhere in the result', !JSON.stringify(boot).includes(identity));
check('BOOT is never said to write', !/write|flash/i.test(boot.apply.how.en.replace(/WORKS/g, '')) && boot.apply.availability === 'works', boot.apply.how.en);
const moved = Uint8Array.from(dme); moved[0x90000] ^= 0xff;
const cmp = mig.bootCompare({ image: dme, other: moved });
check('compare names one byte, in a named region', cmp.result.bytesDiffering === 1 && cmp.result.regions.length === 1, JSON.stringify(cmp.result.regions));
let refused = false;
try { mig.bootBackup({ image: new Uint8Array(65536) }); } catch (e) { refused = /TUNER's/.test(e.message); }
check('a 64 KB calibration partial is sent to TUNER, not read as a backup', refused);

console.log('\n[M35080, on its practice EEPROM]');
const eeprom = new Uint8Array(fs.readFileSync(path.join(root, 'samples', 'practice-m35080.bin')));
const read = mig.m35080Read({ image: eeprom, practice: true });
check('the practice mileage (155,940 km, the fixture\'s default) is read', read.result.odometer?.km === 155940);
check('late layout, checksums holding', read.result.layout === 'late' && read.result.checksums.every(c => c.ok));
const vin = apps.readVins(eeprom).coded?.text;
check('control: the practice EEPROM does carry a VIN to leak', typeof vin === 'string' && vin.length === 7, String(vin));
check('the VIN is nowhere in the result', !JSON.stringify(read).includes(vin) && !JSON.stringify(read).includes(vin.slice(2)));
const dead = mig.m35080Read({ image: new Uint8Array(1024).fill(0xff) });
check('an all-0xFF file is called what it is, and no mileage is read off it', dead.result.chipRead === false && dead.result.odometer === null && /not a chip read/.test(dead.summary));
const edited = Uint8Array.from(eeprom); edited[0x07b] ^= 0x01;
const ecmp = mig.m35080Compare({ image: eeprom, other: edited });
check('compare names a changed VIN byte as the VIN area', ecmp.result.byRegion.vin === 1, JSON.stringify(ecmp.result.byRegion));
check('and still prints neither VIN', !JSON.stringify(ecmp).includes(vin) && !JSON.stringify(ecmp).includes(apps.readVins(edited).coded?.text ?? '#none#'));
check('the M35080 apply says the counter only goes up', /only be raised/.test(read.apply.how.en) && /減らすためのものではありません/.test(read.apply.how.ja));

console.log('\n[the MIGRATION MCP server]');
const client = new Client({ name: 'verify-migration', version: '0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'dist', 'cli.js'), 'mcp', 'migration'], stderr: 'pipe' }));
check('it names itself matrix-tsunagi-migration', client.getServerVersion()?.name === 'matrix-tsunagi-migration');
const { tools } = await client.listTools();
const names = tools.map(t => t.name).sort();
check('five read-only tools', JSON.stringify(names) === JSON.stringify(['about_matrix', 'boot_backup', 'boot_compare', 'm35080_compare', 'm35080_read']) && tools.every(t => t.annotations?.readOnlyHint === true), names.join(', '));
check('no tool can be asked for a file', tools.every(t => !Object.keys(t.inputSchema?.properties ?? {}).some(p => /^out|save/.test(p))));
const viaMcp = JSON.parse((await client.callTool({ name: 'm35080_read', arguments: { use_sample: true } })).content[0].text);
check('m35080_read over MCP: the mileage, and no VIN', viaMcp.result?.odometer?.km === 155940 && !JSON.stringify(viaMcp).includes(vin));
await client.close();

console.log(fails ? `\n${fails} FAIL` : '\nall PASS');
process.exit(fails ? 1 : 0);
