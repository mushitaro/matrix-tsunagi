#!/usr/bin/env node
// Zips plugin/ for claude.ai, which takes a plugin (Customize → Plugins → Upload plugin) or a single
// Skill (Customize → Skills → Upload a skill) as a ZIP:
//
//   node scripts/pack-plugin.mjs        → plugin-dist/matrix-tsunagi-plugin.zip
//                                          plugin-dist/<skill>-skill.zip, one per plugin/skills/<skill>
//
// The plugin ZIP holds plugin/'s contents at its root (.claude-plugin/plugin.json, .mcp.json,
// skills/…); a Skill ZIP holds one folder, <skill>/SKILL.md. Claude Code needs none of this — it
// installs from the marketplace in .claude-plugin/marketplace.json.
//
// No dependency: Node's zlib deflates and checksums, and a ZIP is three small headers around that.
// Every entry is dated 1980-01-01, so the same tree always makes the same bytes.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = path.join(ROOT, 'plugin');
const OUT = path.join(ROOT, 'plugin-dist');

/** Every file under dir, as [zip path, absolute path], sorted so the archive is stable. */
function walk(dir, prefix = '') {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const abs = path.join(dir, e.name);
        const rel = prefix + e.name;
        if (e.isDirectory()) out.push(...walk(abs, rel + '/'));
        else if (e.isFile()) out.push([rel, abs]);
    }
    return out;
}

function zip(entries) {
    const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
    const UTF8 = 0x0800;
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const [name, abs] of entries) {
        const data = fs.readFileSync(abs);
        const packed = zlib.deflateRawSync(data, { level: 9 });
        const crc = zlib.crc32(data) >>> 0;
        const nameBuf = Buffer.from(name, 'utf8');

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(UTF8, 6);
        local.writeUInt16LE(8, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(DOS_DATE, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(packed.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);
        locals.push(local, nameBuf, packed);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(UTF8, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(DOS_DATE, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(packed.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt32LE(offset, 42);
        centrals.push(central, nameBuf);

        offset += local.length + nameBuf.length + packed.length;
    }
    const cd = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(cd.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, cd, end]);
}

const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'));

// claude.ai refuses a Skill whose description is over 1,024 characters — and says only "1 error",
// without which one or why (0.4.0's tuner-drive was 1,730; `claude plugin validate` let it through).
// Refused here, by name, before a ZIP exists to be uploaded.
for (const skill of fs.readdirSync(path.join(PLUGIN, 'skills'), { withFileTypes: true }).filter(e => e.isDirectory())) {
    const text = fs.readFileSync(path.join(PLUGIN, 'skills', skill.name, 'SKILL.md'), 'utf8');
    const description = /^description: (.*)$/m.exec(text)?.[1] ?? '';
    if (!description) throw new Error(`plugin/skills/${skill.name}/SKILL.md has no one-line description`);
    if (description.length > 1024) throw new Error(`plugin/skills/${skill.name}: the description is ${description.length} characters; claude.ai accepts at most 1,024`);
}
fs.mkdirSync(OUT, { recursive: true });

const all = walk(PLUGIN);
const pluginZip = path.join(OUT, `${manifest.name}-plugin.zip`);
fs.writeFileSync(pluginZip, zip(all));
console.log(`${path.relative(ROOT, pluginZip)}  ${manifest.name} ${manifest.version}, ${all.length} file(s): ${all.map(([n]) => n).join(', ')}`);

for (const skill of fs.readdirSync(path.join(PLUGIN, 'skills'), { withFileTypes: true }).filter(e => e.isDirectory())) {
    const files = walk(path.join(PLUGIN, 'skills', skill.name), skill.name + '/');
    if (!files.some(([n]) => n === `${skill.name}/SKILL.md`)) throw new Error(`plugin/skills/${skill.name} has no SKILL.md`);
    const out = path.join(OUT, `${skill.name}-skill.zip`);
    fs.writeFileSync(out, zip(files));
    console.log(`${path.relative(ROOT, out)}  ${files.map(([n]) => n).join(', ')}`);
}
