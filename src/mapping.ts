/**
 * MAPPING — the Matrix category for tools that rewrite a map: MSS54HP CSL CONVERT /// TUNER here,
 * E46M3SMG2 /// MAPPING in mapping-smg2.ts.
 *
 * Each call returns an envelope an assistant can read top to bottom: a `summary` to say, the numbers
 * behind it, where the calculation came from, and — only when the result would have to be written
 * to the car — how that is done.
 *
 * The line this file keeps (operator, 2026-09-30): what the log SAYS is free here, down to the
 * last cell. A file that can be written to the car is made here only for what the free public app
 * also writes (the VE map). For WORKS-only calculations this returns the values and the evidence,
 * and the app makes the file.
 */
import {
    loadBase, loadLog, runVe, buildTuned, channelsIn, coverageRemedy, AXES, BIN_BYTES, InputError,
} from './mapping/tuner';
import type { Base } from './mapping/tuner';
import { APPLY_TUNER_WORKS, APPLY_VE, APPS, STAGE_NOTE } from './facts';
import { envelope as wrap, TOOL_BUILD } from './envelope';
import type { Envelope, Source } from './envelope';
import type { Apply } from './facts';
import dropWhy from './generated/drop-why.json';

export { InputError, BIN_BYTES };
export type { Envelope, Source };
export { smg2Image, smg2Read, smg2Compare } from './mapping-smg2';

const source = (stage: Source['stage']): Source => ({
    tool: APPS.tuner.name,
    ...TOOL_BUILD.tuner(),
    stage,
    ...(stage === 'experimental' ? { note: STAGE_NOTE.experimental } : {}),
});

const envelope = <T>(command: string, summary: string, stage: Source['stage'], result: T, apply?: Apply): Envelope<T> =>
    wrap(command, summary, source(stage), result, apply);

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const pct = (after: number, before: number) => before === 0 ? 0 : Math.round((after / before - 1) * 1000) / 10;
const n = (v: number) => v.toLocaleString('en-US');

/** The PATCH menu's own readouts (TUNER page.tsx, the PATCH group), read off the bytes. */
function patchReadout(b: Base) {
    const t = b.toggles;
    return {
        'MAP': t.applyPatch ? 'OFF' : 'ON',
        'LTFT MIN': t.applyPatch ? '100' : 'OEM',
        'TANK VENT': t.applyTankVentDisable ? 'SHUT' : 'OEM',
        'WOT TH': t.applyWotDisable ? '102.3' : 'OEM',
        'RF GATE': t.applyRfKorrGateDrop ? '0.400' : 'OEM',
    };
}

function checksumReadout(b: Base) {
    return b.checksums.map(s => ({
        slot: s.name,
        stored: '0x' + s.storedChecksum.toString(16).toUpperCase().padStart(4, '0'),
        calculated: '0x' + s.calculatedChecksum.toString(16).toUpperCase().padStart(4, '0'),
        valid: s.isValid,
    }));
}

type DropReason = keyof typeof dropWhy.en;

function dropReadout(census: Record<string, number>) {
    return Object.entries(census)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) => ({
            reason,
            samples: count,
            why: { en: dropWhy.en[reason as DropReason], ja: dropWhy.ja[reason as DropReason] },
        }));
}

// ------------------------------------------------------------------------------------------------

export interface ReadBinInput { bin: Uint8Array }

/** What is in a 64 KB MSS54HP calibration partial: the VE table, the patch state, the checksums. */
export function readBin({ bin }: ReadBinInput) {
    const b = loadBase(bin);
    const valid = b.checksums.every(s => s.isValid);
    const patches = patchReadout(b);
    const armed = Object.entries(patches).filter(([, v]) => v !== 'OEM' && v !== 'ON').map(([k, v]) => `${k} ${v}`);
    const summary = [
        `A ${n(BIN_BYTES)}-byte MSS54HP calibration partial.`,
        valid ? 'Both checksum slots validate.' : 'A checksum slot does NOT validate — this image would be refused by the DME as it stands, or it is not an MSS54HP partial.',
        armed.length ? `Logic patches present: ${armed.join(', ')}.` : 'No logic patch is present; every patched value reads as stock (OEM).',
        `${b.parser.veCellsOffStock()} of 480 VE cells and ${b.parser.warmupCellsOffStock()} warm-up cells differ from stock; WOT fuel is ${b.parser.wotFuelIsStock() ? 'stock' : 'not stock'}.`,
    ].join(' ');
    return envelope('bin', summary, 'stable', {
        bytes: BIN_BYTES,
        checksums: checksumReadout(b),
        patches,
        veCellsOffStock: b.parser.veCellsOffStock(),
        warmupCellsOffStock: b.parser.warmupCellsOffStock(),
        wotFuelIsStock: b.parser.wotFuelIsStock(),
        hasEgtTables: !!b.egt,
        hasLambdaLimits: !!b.lambdaLimits,
        ve: {
            rows: 'relative opening, %', cols: 'engine speed, rpm',
            load: b.map.yAxis, rpm: b.map.xAxis, values: b.map.data.map(row => row.map(r3)),
        },
    });
}

// ------------------------------------------------------------------------------------------------

export interface ReadLogInput {
    csv: string;
    fileName?: string;
    /** Optional. With it, the DME's own lambda-control thresholds gate the samples, as in the app. */
    bin?: Uint8Array;
}

/** What a drive log carries and how much of it the VE and rf_korr calculations can use. */
export function readLog({ csv, fileName = 'log.csv', bin }: ReadLogInput) {
    const b = bin ? loadBase(bin) : null;
    const { raw, processed } = loadLog(csv, fileName, b?.lambdaLimits ?? null);
    const channels = channelsIn(raw);
    const times = raw.map(p => p.time).filter(t => Number.isFinite(t));
    const duration = times.length > 1 ? Math.round((times[times.length - 1] - times[0]) * 10) / 10 : null;
    const has = (k: string) => channels.some(c => c.key === k);
    const trim = has('stft1') || has('stft2');
    const egt = has('exhaustTemp');
    const drops = dropReadout(processed.dropCensus as unknown as Record<string, number>);
    const summary = [
        `${n(raw.length)} rows${duration !== null ? ` over ${duration} s` : ''}, ${channels.length} channels TUNER recognises.`,
        `${n(processed.data.length)} rows are usable for the VE map and ${n(processed.rfKorrData.length)} for the rf_korr table.`,
        drops.length ? `Left out: ${drops.slice(0, 4).map(d => `${n(d.samples)} ${d.reason}`).join(', ')}${drops.length > 4 ? ', …' : ''} — each reason says what to change on the next drive.` : '',
        trim ? '' : 'There is no lambda trim channel, so no VE correction can be derived from this log.',
        bin ? '' : 'Pass the BIN it was driven on to gate samples by that DME\'s own lambda thresholds, as the app does.',
    ].filter(Boolean).join(' ');
    return envelope('log', summary, 'stable', {
        rows: raw.length,
        durationSeconds: duration,
        channels,
        usable: { ve: processed.data.length, rfKorr: processed.rfKorrData.length },
        leftOut: drops,
        canDerive: { ve: trim, rfKorr: trim && egt },
        gatedByBin: !!bin,
    });
}

// ------------------------------------------------------------------------------------------------

export interface ProposeInput { bin: Uint8Array; csv: string; fileName?: string }

/**
 * The VE map a drive supports, cell by cell — and the tuned BIN, byte-for-byte TUNER's DOWNLOAD
 * TUNED, since the free public app makes that same file.
 */
export function proposeVe({ bin, csv, fileName = 'log.csv' }: ProposeInput) {
    const b = loadBase(bin);
    const { raw, processed } = loadLog(csv, fileName, b.lambdaLimits);
    const { ve, coverage, census } = runVe(b, processed);
    const before = b.map.data;
    const after = ve.newMap?.data ?? before;

    const changed: { rpm: number; load: number; before: number; after: number; changePercent: number; samples: number }[] = [];
    const toDrive: { rpm: number; load: number; samples: number; reason: string; remedy: { en?: string; ja?: string } }[] = [];
    let notDriven = 0;
    let belowReach = 0;
    coverage.forEach((row, r) => row.forEach(cell => {
        const c = cell.col;
        if (r3(after[r][c]) !== r3(before[r][c])) {
            changed.push({ rpm: AXES.rpm[c], load: AXES.load[r], before: r3(before[r][c]), after: r3(after[r][c]), changePercent: pct(after[r][c], before[r][c]), samples: cell.samples });
        }
        if (cell.state === 'refused') {
            toDrive.push({ rpm: AXES.rpm[c], load: AXES.load[r], samples: cell.samples, reason: String(cell.reason), remedy: { en: coverageRemedy(cell.reason, 'en'), ja: coverageRemedy(cell.reason, 'ja') } });
        }
        if (cell.state === 'unvisited') { if (cell.belowReach) belowReach++; else notDriven++; }
    }));
    changed.sort((a, z) => Math.abs(z.changePercent) - Math.abs(a.changePercent));
    toDrive.sort((a, z) => z.samples - a.samples);

    const tuned = buildTuned(b, ve.newMap);
    const top = changed[0];
    const summary = [
        `${n(processed.data.length)} of ${n(raw.length)} rows reached the VE calculation.`,
        changed.length
            ? `${changed.length} of 480 cells change; the largest is ${top.changePercent > 0 ? '+' : ''}${top.changePercent} % at ${top.rpm} rpm, ${top.load} % opening.`
            : 'No cell changes: the log supports the map as it is, or did not reach any cell with enough evidence.',
        `${census.settled} cells were measured and need no change, ${census.refused} had samples but not enough evidence (each has a remedy), and ${notDriven} were not driven${belowReach ? ` (${belowReach} more lie below the lowest opening this engine reached)` : ''}.`,
        'The tuned BIN this can save has its checksums corrected and is byte-for-byte what TUNER\'s DOWNLOAD TUNED gives for these two files.',
    ].join(' ');

    return {
        ...envelope('ve', summary, 'stable', {
            rows: raw.length,
            usable: processed.data.length,
            leftOut: dropReadout(processed.dropCensus as unknown as Record<string, number>),
            cells: { total: 480, changed: changed.length, ...census, notDriven, belowReach },
            changed,
            toDrive,
            table: {
                rows: 'relative opening, %', cols: 'engine speed, rpm',
                load: b.map.yAxis, rpm: b.map.xAxis,
                before: before.map(row => row.map(r3)),
                after: after.map(row => row.map(r3)),
            },
        }, APPLY_VE),
        /** Not serialised into the envelope; the CLI and the MCP server write it where asked. */
        tunedBin: tuned,
    };
}

// ------------------------------------------------------------------------------------------------

/**
 * The rf_korr (KF_RF_KORR_DRREL) table a drive supports. EXPERIMENTAL in the app and WORKS-only to
 * write, so this returns the values and the evidence — no file.
 */
export function proposeRfKorr({ bin, csv, fileName = 'log.csv' }: ProposeInput) {
    const b = loadBase(bin);
    const { processed } = loadLog(csv, fileName, b.lambdaLimits);
    const { rfKorr } = runVe(b, processed);
    const apply = APPLY_TUNER_WORKS({ en: 'The rf_korr table', ja: 'rf_korr の表' });
    if (!rfKorr) {
        return envelope('rfkorr', 'This BIN\'s exhaust-temperature tables could not be decoded, so there is nothing to derive the rf_korr table against.', 'experimental', null, apply);
    }
    const rep = rfKorr.report;
    const updated = rfKorr.updated.flat().filter(Boolean).length;
    const summary = [
        `${n(rep.samplesTotal)} samples examined; ${n(rep.anchorSamples)} anchored and ${n(rep.ratioSamples)} carried a ratio.`,
        rep.sensorMissing ? 'The log has no exhaust-temperature channel, so nothing can be derived.' : '',
        rep.trimMissing ? 'The log has no lambda trim, so the derived table would only repeat the one already in the ECU — nothing is proposed.' : '',
        rep.samplesGateShut ? `${n(rep.samplesGateShut)} were below the filling floor, where the DME applies no correction — a road drive is mostly this; pulls above it are what feed this table.` : '',
        `${updated} of ${rfKorr.tuned.length * (rfKorr.tuned[0]?.length ?? 0)} cells ${rfKorr.acceptable ? 'moved enough to be worth writing' : 'moved, not enough to be worth writing'}; the largest change is ${r3(rep.largestChange)}.`,
    ].filter(Boolean).join(' ');
    return envelope('rfkorr', summary, 'experimental', {
        acceptable: rfKorr.acceptable,
        rows: 'exhaust-temperature delta (TABG Δ), °C', cols: 'engine speed, rpm',
        delta: rfKorr.delta, rpm: rfKorr.rpm,
        stock: rfKorr.stock.map(row => row.map(r3)),
        proposed: rfKorr.tuned.map(row => row.map(r3)),
        measured: rfKorr.measuredMap.map(row => row.map(r3)),
        samples: rfKorr.countMap,
        updated: rfKorr.updated,
        rejected: rfKorr.rejected,
        report: rep,
    }, apply);
}
