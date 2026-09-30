/**
 * `matrix-tsunagi` — the command line an assistant runs. JSON out, JSON errors, no prompts, no
 * network. See `matrix-tsunagi describe`.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe } from './describe';
import { readBin, readLog, proposeVe, proposeRfKorr, InputError } from './mapping';
import { smg2Image, smg2Read, smg2Compare, buildPracticeImage } from './mapping-smg2';
import { APPLY_SMG2, APPLY_TUNER_WORKS } from './facts';
import { SAMPLE } from './samples';
import { serveMapping } from './mcp';

class UsageError extends Error {}

function parse(argv: string[]) {
    const pos: string[] = [];
    const flags: Record<string, string | true> = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; } else flags[key] = true;
        } else pos.push(a);
    }
    return { pos, flags };
}

function only(flags: Record<string, unknown>, allowed: string[], command: string) {
    const extra = Object.keys(flags).filter(f => !allowed.includes(f));
    if (extra.length) throw new UsageError(`"${command}" does not take --${extra.join(', --')}. It takes: ${allowed.map(f => '--' + f).join(', ') || 'no options'}.`);
}

function readFile(p: string, what: string): Buffer {
    try {
        return fs.readFileSync(p);
    } catch {
        throw new UsageError(`Cannot read the ${what} at ${p}.`);
    }
}

function inputs(flags: Record<string, string | true>, need: { bin: boolean; log: boolean }) {
    const sample = flags.sample === true;
    const binPath = sample ? SAMPLE.bin : typeof flags.bin === 'string' ? flags.bin : null;
    const logPath = sample ? SAMPLE.log : typeof flags.log === 'string' ? flags.log : null;
    if (need.bin && !binPath) throw new UsageError('Give the DME image with --bin <file.bin>, or --sample for the practice files.');
    if (need.log && !logPath) throw new UsageError('Give the drive log with --log <file.csv>, or --sample for the practice files.');
    return {
        bin: binPath ? new Uint8Array(readFile(binPath, 'BIN')) : undefined,
        csv: logPath ? readFile(logPath, 'log').toString('utf8') : undefined,
        fileName: logPath ? path.basename(logPath) : undefined,
        sample,
    };
}

const print = (v: unknown) => process.stdout.write(JSON.stringify(v, null, 2) + '\n');

async function main(argv: string[]) {
    const { pos, flags } = parse(argv);
    const [group, command, file] = pos;

    if (!group || group === 'describe' || flags.help === true) {
        print(describe());
        return;
    }
    if (group === 'mcp') {
        if (command !== 'mapping') throw new UsageError('Only the MAPPING MCP server exists so far: matrix-tsunagi mcp mapping');
        await serveMapping();
        return;
    }
    if (group !== 'mapping') throw new UsageError(`Unknown category "${group}". Run "matrix-tsunagi describe" for what exists.`);

    switch (command) {
        case 'bin': {
            only(flags, ['bin', 'sample'], 'mapping bin');
            if (file && flags.bin === undefined) flags.bin = file;
            print(readBin({ bin: inputs(flags, { bin: true, log: false }).bin! }));
            return;
        }
        case 'log': {
            only(flags, ['log', 'bin', 'sample'], 'mapping log');
            if (file && flags.log === undefined) flags.log = file;
            const i = inputs(flags, { bin: false, log: true });
            print(readLog({ csv: i.csv!, fileName: i.fileName, bin: i.bin }));
            return;
        }
        case 've': {
            only(flags, ['bin', 'log', 'sample', 'out'], 'mapping ve');
            const i = inputs(flags, { bin: true, log: true });
            const { tunedBin, ...env } = proposeVe({ bin: i.bin!, csv: i.csv!, fileName: i.fileName });
            let saved = null;
            if (typeof flags.out === 'string') {
                fs.writeFileSync(flags.out, tunedBin);
                saved = { path: path.resolve(flags.out), bytes: tunedBin.byteLength, sha256: crypto.createHash('sha256').update(tunedBin).digest('hex') };
            }
            print({ ...env, result: { ...env.result, tunedBin: saved ?? 'not saved — add --out <tuned.bin> to write it' } });
            return;
        }
        case 'rfkorr': {
            if (flags.out !== undefined) {
                const apply = APPLY_TUNER_WORKS({ en: 'The rf_korr table', ja: 'rf_korr の表' });
                throw new UsageError(`rf_korr returns the values only. ${apply.how.en}`);
            }
            only(flags, ['bin', 'log', 'sample'], 'mapping rfkorr');
            const i = inputs(flags, { bin: true, log: true });
            print(proposeRfKorr({ bin: i.bin!, csv: i.csv!, fileName: i.fileName }));
            return;
        }
        case 'smg2': {
            const [, , sub, first, second] = pos;
            const practice = flags.sample === true;
            const image = () => {
                if (practice) return buildPracticeImage();
                const p = typeof flags.image === 'string' ? flags.image : first;
                if (!p) throw new UsageError('Give the SMG II image: matrix-tsunagi mapping smg2 ' + (sub ?? 'image') + ' <image.bin>, or --sample for the practice image.');
                return new Uint8Array(readFile(p, 'SMG II image'));
            };
            const xdf = () => {
                if (typeof flags.xdf !== 'string') {
                    throw new UsageError(`Decoding needs the MS4X definition: --xdf Siemens_SMG_II_510_24K.xdf (a 24 KiB window) or _512K.xdf (a full read). It is MS4X's and not shipped here. ${APPLY_SMG2.how.en}`);
                }
                return readFile(flags.xdf, 'XDF').toString('utf8');
            };
            switch (sub) {
                case 'image':
                    only(flags, ['image', 'sample'], 'mapping smg2 image');
                    print(smg2Image({ image: image(), practice }));
                    return;
                case 'read':
                    only(flags, ['image', 'sample', 'xdf', 'item'], 'mapping smg2 read');
                    print(smg2Read({ image: image(), xdf: xdf(), item: typeof flags.item === 'string' ? flags.item : undefined, practice }));
                    return;
                case 'compare': {
                    only(flags, ['xdf'], 'mapping smg2 compare');
                    if (!first || !second) throw new UsageError('Give two images: matrix-tsunagi mapping smg2 compare <a.bin> <b.bin> --xdf <definition.xdf>');
                    print(smg2Compare({ image: new Uint8Array(readFile(first, 'SMG II image')), other: new Uint8Array(readFile(second, 'SMG II image')), xdf: xdf() }));
                    return;
                }
                default:
                    throw new UsageError(`Unknown SMG2 command "${sub ?? ''}". It has: image, read, compare. Run "matrix-tsunagi describe".`);
            }
        }
        default:
            throw new UsageError(`Unknown MAPPING command "${command ?? ''}". It has: bin, log, ve, rfkorr (TUNER) and smg2 image, smg2 read, smg2 compare (SMG2). Run "matrix-tsunagi describe".`);
    }
}

main(process.argv.slice(2)).catch((e: unknown) => {
    const known = e instanceof UsageError || e instanceof InputError;
    process.stderr.write(JSON.stringify({
        error: known ? (e as Error).message : `Unexpected failure: ${(e as Error)?.message ?? String(e)}`,
        help: 'matrix-tsunagi describe',
    }, null, 2) + '\n');
    process.exit(1);
});
