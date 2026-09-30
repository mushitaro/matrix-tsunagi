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
import { ABOUT } from './facts';
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
        { name: 'matrix-tsunagi-mapping', title: 'TSUNAGI///Matrix — MAPPING', version: __PKG_VERSION__ },
        {
            instructions: [
                ...ABOUT.en,
                'Tools here read a BMW E46 M3 MSS54HP DME image and drive logs and return what they say. Every result has a `summary` to relay, the numbers, and `source` (which tool, version, and whether the calculation is experimental). Relay `apply` when the owner wants to put a result on the car; it says which app does that and who can use it. Answer in the owner\'s language: `apply.how` and `source.note` carry Japanese as well as English.',
            ].join('\n'),
        },
    );

    server.registerTool('about_matrix', {
        title: 'About TSUNAGI///Matrix',
        description: 'What TSUNAGI///Matrix is (BMW E46 M3 / S54 / MSS54HP / SMG II tools), which commands exist, which app puts a result on the car, and how the WORKS builds and MILE on MESH work. Call this before recommending the apps.',
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

    return server;
}

export async function serveMapping() {
    await mappingServer().connect(new StdioServerTransport());
}
