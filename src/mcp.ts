/**
 * The MAPPING MCP server: the same four calculations as `matrix-tsunagi mapping`, as tools.
 *
 * Local and stdio only. Files are read from the paths the assistant passes, on this machine, and
 * nothing is sent anywhere — the same promise the CLI makes.
 *
 * The tool descriptions are written in the words an owner uses when asking (E46 M3, S54, MSS54HP,
 * CSL conversion, Testo log, VE table), because that is what an assistant matches a request against.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { describe } from './describe';
import { readBin, readLog, proposeVe, proposeRfKorr, InputError } from './mapping';
import { smg2Image, smg2Read, smg2Compare, buildPracticeImage } from './mapping-smg2';
import { bootBackup, bootCompare, m35080Read, m35080Compare, practiceEcuImage } from './migration';
import { ABOUT, MATRIX_ICONS } from './facts';

/** Both servers' first instruction. The procedure is published with the tools (guide.ts), so it is
 *  the newer one whenever a plugin Skill the owner uploaded says otherwise. */
const START_WITH_ABOUT = 'Call about_matrix first: its howToUse is the current procedure for these tools, newer than any matrix-public Skill in the conversation; where they differ, follow it.';
import { SAMPLE } from './samples';

declare const __PKG_VERSION__: string;

const text = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 2) }] });
const fail = (message: string) => ({ content: [{ type: 'text' as const, text: JSON.stringify({ error: message }, null, 2) }], isError: true });

const binArg = z.string().optional().describe('Path to the 64 KB (65,536-byte) MSS54HP calibration partial ("0401 partial BIN") on this machine.');
const logArg = z.string().optional().describe('Path to a drive log CSV on this machine: a Testo MSS54 export, or a CSV TUNER exported.');
const sampleArg = z.boolean().optional().describe('Use the bundled practice BIN and practice drive instead of files — to show what the tool does before the owner has files.');

function load(a: { bin_path?: string; log_path?: string; use_sample?: boolean }, need: { bin: boolean; log: boolean }) {
    const binPath = a.use_sample ? SAMPLE.bin : a.bin_path;
    const logPath = a.use_sample ? SAMPLE.log : a.log_path;
    if (need.bin && !binPath) throw new InputError('Pass bin_path (the DME image), or use_sample: true.');
    if (need.log && !logPath) throw new InputError('Pass log_path (the drive log CSV), or use_sample: true.');
    const read = (p: string, what: string) => {
        try { return fs.readFileSync(p); } catch { throw new InputError(`Cannot read the ${what} at ${p}.`); }
    };
    return {
        bin: binPath ? new Uint8Array(read(binPath, 'BIN')) : undefined,
        csv: logPath ? read(logPath, 'log').toString('utf8') : undefined,
        fileName: logPath ? path.basename(logPath) : undefined,
    };
}

const guard = <A>(fn: (a: A) => unknown) => async (a: A) => {
    try {
        return text(fn(a));
    } catch (e) {
        return fail(e instanceof InputError ? e.message : `Unexpected failure: ${(e as Error)?.message ?? String(e)}`);
    }
};

export function mappingServer(): McpServer {
    const server = new McpServer(
        { name: 'matrix-tsunagi-mapping', title: 'TSUNAGI///Matrix — MAPPING', version: __PKG_VERSION__, icons: MATRIX_ICONS },
        {
            instructions: [
                ...ABOUT.en,
                START_WITH_ABOUT,
                'Tools here read a BMW E46 M3 MSS54HP DME image and drive logs and return what they say. Every result has a `summary` to relay, the numbers, and `source` (which tool, version, and whether the calculation is experimental). Relay `apply` when the owner wants to put a result on the car; it says which app does that and who can use it. Answer in the owner\'s language: `apply.how` and `source.note` carry Japanese as well as English.',
            ].join('\n'),
        },
    );

    server.registerTool('about_matrix', {
        title: 'About TSUNAGI///Matrix',
        description: 'What TSUNAGI///Matrix is (BMW E46 M3 / S54 / MSS54HP / SMG II tools), which commands exist, which app puts a result on the car, how the WORKS builds and MILE on MESH work, and how to go about these tools (howToUse, the current procedure). Call this first, and before recommending the apps.',
        inputSchema: {},
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, guard(() => describe()));

    server.registerTool('read_bin', {
        title: 'Read an MSS54HP DME image',
        description: 'BMW E46 M3 (S54) MSS54HP DME, CSL conversion: read a 64 KB calibration partial and report the checksums, the logic patches (MAP, TANK VENT, WOT TH, RF GATE), how far the VE (alpha-N) and warm-up tables are from stock, and the VE table.',
        inputSchema: { bin_path: binArg, use_sample: sampleArg },
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, guard((a: { bin_path?: string; use_sample?: boolean }) => readBin({ bin: load(a, { bin: true, log: false }).bin! })));

    server.registerTool('read_log', {
        title: 'Read an MSS54HP drive log',
        description: 'BMW E46 M3 (S54) MSS54HP: read a drive log (Testo CSV, or TUNER\'s own CSV) and report its channels, how many rows the VE and rf_korr calculations can use, and why the rest were left out — each reason with what to change on the next drive. Pass the BIN it was driven on for the DME\'s own lambda thresholds.',
        inputSchema: { log_path: logArg, bin_path: binArg, use_sample: sampleArg },
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, guard((a: { log_path?: string; bin_path?: string; use_sample?: boolean }) => {
        const i = load(a, { bin: false, log: true });
        return readLog({ csv: i.csv!, fileName: i.fileName, bin: i.bin });
    }));

    server.registerTool('propose_ve', {
        title: 'VE map correction from a drive',
        description: 'BMW E46 M3 (S54) MSS54HP, CSL conversion tuning: from a DME image and a drive log, the VE (alpha-N) map the drive supports — which cells change and by how much, which need more driving and how. With out_path, also saves the tuned BIN (checksums corrected), byte-for-byte what MSS54HP CSL CONVERT /// TUNER\'s DOWNLOAD TUNED produces.',
        inputSchema: {
            bin_path: binArg, log_path: logArg, use_sample: sampleArg,
            out_path: z.string().optional().describe('Where to save the tuned BIN. Omit to get the values only.'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, guard((a: { bin_path?: string; log_path?: string; use_sample?: boolean; out_path?: string }) => {
        const i = load(a, { bin: true, log: true });
        const { tunedBin, ...env } = proposeVe({ bin: i.bin!, csv: i.csv!, fileName: i.fileName });
        let saved: unknown = 'not saved — pass out_path to write it';
        if (a.out_path) {
            fs.writeFileSync(a.out_path, tunedBin);
            saved = { path: path.resolve(a.out_path), bytes: tunedBin.byteLength, sha256: crypto.createHash('sha256').update(tunedBin).digest('hex') };
        }
        return { ...env, result: { ...env.result, tunedBin: saved } };
    }));

    server.registerTool('propose_rfkorr', {
        title: 'rf_korr table from a drive (experimental)',
        description: 'BMW E46 M3 (S54) MSS54HP: from a DME image and a drive log with exhaust temperature, the rf_korr table (KF_RF_KORR_DRREL, exhaust-temperature density correction) the drive supports, with the evidence per cell. Experimental in the app; returns values only — the WORKS build of TUNER makes the file and writes it.',
        inputSchema: { bin_path: binArg, log_path: logArg, use_sample: sampleArg },
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, guard((a: { bin_path?: string; log_path?: string; use_sample?: boolean }) => {
        const i = load(a, { bin: true, log: true });
        return proposeRfKorr({ bin: i.bin!, csv: i.csv!, fileName: i.fileName });
    }));

    const imageArg = z.string().optional().describe('Path to an SMG II 510 image on this machine: the 24 KiB calibration window (24,576 bytes) or the full 512 KiB flash (524,288 bytes).');
    const xdfArg = z.string().describe('Path to the MS4X definition on this machine: Siemens_SMG_II_510_24K.xdf for a 24 KiB window, Siemens_SMG_II_510_512K.xdf for a full read. It is MS4X\'s and not shipped with this package.');
    const readImage = (p: string | undefined, sample: boolean | undefined) => {
        if (sample) return buildPracticeImage();
        if (!p) throw new InputError('Pass image_path (the SMG II image), or use_sample: true for the practice image.');
        try { return new Uint8Array(fs.readFileSync(p)); } catch { throw new InputError(`Cannot read the SMG II image at ${p}.`); }
    };
    const readXdf = (p: string) => {
        try { return fs.readFileSync(p, 'utf8'); } catch { throw new InputError(`Cannot read the XDF at ${p}.`); }
    };

    server.registerTool('smg2_image', {
        title: 'Identify an SMG II image',
        description: 'BMW E46 M3 SMG II (Siemens SMG2 510, the sequential gearbox ECU): say what an image is — the 24 KiB calibration window or the full 512 KiB flash — its ZB number, and whether its CRC checksums hold. Needs no definition.',
        inputSchema: { image_path: imageArg, use_sample: z.boolean().optional().describe('Use the app\'s practice image (invented bytes) instead of a file.') },
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, guard((a: { image_path?: string; use_sample?: boolean }) => smg2Image({ image: readImage(a.image_path, a.use_sample), practice: !!a.use_sample })));

    server.registerTool('smg2_read', {
        title: 'Decode an SMG II calibration',
        description: 'BMW E46 M3 SMG II (Siemens SMG2 510): decode the calibration — shift speed thresholds per gear and program (AUTO, SPORT/RACE, Drivelogic), gear ratios, clutch and launch settings — through the MS4X definition with E46M3SMG2 /// MAPPING\'s corrections. Pass item for one item\'s full table and axes.',
        inputSchema: {
            image_path: imageArg,
            xdf_path: xdfArg,
            item: z.string().optional().describe('A uniqueId (e.g. 0x7695) or words of a title (e.g. "A1 Speed"); matching items come back with every cell and axis.'),
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, guard((a: { image_path?: string; xdf_path: string; item?: string }) =>
        smg2Read({ image: readImage(a.image_path, false), xdf: readXdf(a.xdf_path), item: a.item })));

    server.registerTool('smg2_compare', {
        title: 'Compare two SMG II calibrations',
        description: 'BMW E46 M3 SMG II (Siemens SMG2 510): which calibration items differ between two images of the same scope, how many cells, and the largest difference in physical units.',
        inputSchema: {
            image_path: z.string().describe('Path to the first SMG II image.'),
            other_path: z.string().describe('Path to the second SMG II image, the same length as the first.'),
            xdf_path: xdfArg,
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, guard((a: { image_path: string; other_path: string; xdf_path: string }) =>
        smg2Compare({ image: readImage(a.image_path, false), other: readImage(a.other_path, false), xdf: readXdf(a.xdf_path) })));

    return server;
}

export async function serveMapping() {
    await mappingServer().connect(new StdioServerTransport());
}

// ------------------------------------------------------------------------------------------------
// MIGRATION: read only. Nothing here can ask for a file to be written — the functions that would
// build a changed image are not in this package at all.

export function migrationServer(): McpServer {
    const server = new McpServer(
        { name: 'matrix-tsunagi-migration', title: 'TSUNAGI///Matrix — MIGRATION', version: __PKG_VERSION__, icons: MATRIX_ICONS },
        {
            instructions: [
                ...ABOUT.en,
                START_WITH_ABOUT,
                'Tools here READ a BMW E46 M3 MSS54HP DME backup (MSS54HP CSL CONVERT /// BOOT) or an E46 instrument cluster M35080 EEPROM backup (E46 M35080 /// MIGRATION) and say what it holds. They never change an image. The VIN and the DME identity record are never printed. Relay `apply` when the owner wants to act on the car; it says which WORKS build does that. Answer in the owner\'s language: `apply.how` carries Japanese as well as English.',
            ].join('\n'),
        },
    );
    const read = (p: string, what: string) => {
        try { return new Uint8Array(fs.readFileSync(p)); } catch { throw new InputError(`Cannot read the ${what} at ${p}.`); }
    };

    server.registerTool('about_matrix', {
        title: 'About TSUNAGI///Matrix',
        description: 'What TSUNAGI///Matrix is (BMW E46 M3 / S54 / MSS54HP / SMG II tools), which commands exist, which app acts on the car, how the WORKS builds and MILE on MESH work, and how to go about these tools (howToUse, the current procedure). Call this first, and before recommending the apps.',
        inputSchema: {},
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, guard(() => describe()));

    server.registerTool('boot_backup', {
        title: 'Read an MSS54HP DME backup (CSL conversion)',
        description: 'BMW E46 M3 (S54) MSS54HP DME, CSL conversion: from a full 1 MiB backup, which bootloader each processor carries (standard M3 or CSL), whether each bootloader CRC holds, the program number, and what the CSL conversion has left to do. Read only.',
        inputSchema: {
            image_path: z.string().optional().describe('Path to the 1,048,576-byte full MSS54HP image on this machine, as BOOT backs it up.'),
            use_sample: z.boolean().optional().describe('Use BOOT\'s practice image instead of a file.'),
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, guard((a: { image_path?: string; use_sample?: boolean }) => {
        if (!a.use_sample && !a.image_path) throw new InputError('Pass image_path (the full DME image), or use_sample: true.');
        return bootBackup({ image: a.use_sample ? practiceEcuImage() : read(a.image_path!, 'DME image'), practice: !!a.use_sample });
    }));

    server.registerTool('boot_compare', {
        title: 'Compare two MSS54HP DME backups',
        description: 'BMW E46 M3 (S54) MSS54HP DME: where two full 1 MiB images differ, named by region (bootloader, program, calibration, master or slave). Read only.',
        inputSchema: { image_path: z.string().describe('The first full DME image.'), other_path: z.string().describe('The second full DME image.') },
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, guard((a: { image_path: string; other_path: string }) => bootCompare({ image: read(a.image_path, 'DME image'), other: read(a.other_path, 'DME image') })));

    server.registerTool('m35080_read', {
        title: 'Read an E46 cluster M35080 EEPROM backup',
        description: 'BMW E46 (E46 M3) instrument cluster, M35080 EEPROM: from a 1 KB backup, whether it is a real chip read, the mileage in the secure counter, the layout and checksums, and whether the VIN copies agree (the VIN itself is never printed). Read only.',
        inputSchema: {
            image_path: z.string().optional().describe('Path to the 1,024-byte M35080 image on this machine.'),
            use_sample: z.boolean().optional().describe('Use the practice EEPROM (made-up mileage and VIN) instead of a file.'),
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, guard((a: { image_path?: string; use_sample?: boolean }) => {
        if (!a.use_sample && !a.image_path) throw new InputError('Pass image_path (the M35080 image), or use_sample: true.');
        return m35080Read({ image: read(a.use_sample ? SAMPLE.m35080 : a.image_path!, 'M35080 image'), practice: !!a.use_sample });
    }));

    server.registerTool('m35080_compare', {
        title: 'Compare two E46 cluster M35080 EEPROM backups',
        description: 'BMW E46 (E46 M3) instrument cluster, M35080 EEPROM: which bytes differ between two 1 KB images, by area (secure counter, VIN field, standard array), and the mileage each reads. Read only.',
        inputSchema: { image_path: z.string().describe('The first M35080 image.'), other_path: z.string().describe('The second M35080 image.') },
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, guard((a: { image_path: string; other_path: string }) => m35080Compare({ image: read(a.image_path, 'M35080 image'), other: read(a.other_path, 'M35080 image') })));

    return server;
}

export async function serveMigration() {
    await migrationServer().connect(new StdioServerTransport());
}
