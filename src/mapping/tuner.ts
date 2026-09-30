/**
 * MSS54HP CSL CONVERT /// TUNER's file workflow, headless: UPLOAD BIN, TESTO CSV, DOWNLOAD TUNED.
 *
 * Every function the bytes pass through is the app's own, imported from the TUNER repository at
 * the commit `vendor/tuner` is pinned to. Only the ORDER is re-composed here, because the app
 * composes inside React hooks — and it is the same order `scripts/verify-file-workflow.mjs` in
 * that repository re-composes, the file whose GOLDEN was measured from the app's DOWNLOAD TUNED.
 * `npm run verify:golden` holds this file to that hash, read out of the pinned commit, so the two
 * cannot drift without a FAIL.
 *
 * Keep this a transcription. A step that exists here and not in the app is a second opinion, and
 * a second opinion about a fuel table is how an engine gets hurt.
 */
import { parseLogFile } from '@/lib/log-engine/parser';
import { processLogData } from '@/lib/log-engine/filter';
import { DEFAULT_FILTER_CONFIG } from '@/lib/log-engine/filterDefaults';
import { VECalculator } from '@/lib/ve-calculator/calculator';
import { tuneRfKorrTable } from '@/lib/ve-calculator/rfKorrTuner';
import type { RfKorrTuneResult } from '@/lib/ve-calculator/rfKorrTuner';
import { readEgtTables } from '@/lib/ve-calculator/egtTables';
import { readRfPtKorrCurves } from '@/lib/ve-calculator/chargeTemp';
import { writtenVeGrid } from '@/lib/ve-calculator/composeVeGrid';
import { buildCoverage, coverageCensus, coverageRemedy } from '@/lib/ve-calculator/cellCoverage';
import type { CellCoverage } from '@/lib/ve-calculator/cellCoverage';
import { BinaryParser } from '@/lib/binary-engine/parser';
import { BinaryPatcher, readLogicPatches, bytesAsRun } from '@/lib/binary-engine/patcher';
import type { LogicPatches } from '@/lib/binary-engine/patcher';
import { analyzeDataChecksum, DATA_PAIR_LENGTH } from '@/lib/checksum/dmeDataChecksum';
import { isFieldPresent, LOG_FIELD_REGISTRY } from '@/lib/field-registry/registry';
import type { FieldKey } from '@/lib/field-registry/registry';
import { APP_CONFIG } from '@/config/constants';
import type { LogDataPoint, ProcessedLog, VEMap } from '@/lib/types';

export { coverageRemedy };
export type { CellCoverage, LogicPatches, RfKorrTuneResult };

/** The one BIN format the app's writers accept: the 64 KB "0401 partial BIN". */
export const BIN_BYTES = DATA_PAIR_LENGTH;

export class InputError extends Error {}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** UPLOAD BIN. What `useBinaryFile.uploadBinary` reads off the bytes on a fresh load. */
export function loadBase(bytes: Uint8Array) {
    if (bytes.byteLength !== BIN_BYTES) {
        throw new InputError(
            `Expected the ${BIN_BYTES}-byte MSS54HP calibration partial ("0401 partial BIN") that TUNER's `
            + `UPLOAD BIN takes; this file is ${bytes.byteLength} bytes.`);
    }
    const base = toArrayBuffer(bytes);
    const parser = new BinaryParser(base);
    const toggles = readLogicPatches(base);
    return {
        base,
        parser,
        map: parser.getVETable(),
        toggles,
        egt: readEgtTables(base),
        curves: readRfPtKorrCurves(base),
        // page.tsx's lambdaLimits memo: read from the image as it RUNS, toggles applied.
        lambdaLimits: new BinaryParser(bytesAsRun(base, toggles)).readLambdaLimits(),
        checksums: analyzeDataChecksum(new Uint8Array(base)),
    };
}
export type Base = ReturnType<typeof loadBase>;

/** TESTO CSV. `useLogFile.parseAndSetLog`: parseLogFile, then processLogData under the defaults. */
export function loadLog(csvText: string, fileName: string, lambdaLimits: Base['lambdaLimits'] | null) {
    let raw: LogDataPoint[];
    try {
        raw = parseLogFile(csvText);
    } catch (e) {
        throw new InputError((e as Error).message);
    }
    if (!raw.length) throw new InputError('The CSV has a header but no rows TUNER could read.');
    const processed: ProcessedLog = processLogData(
        raw, fileName, DEFAULT_FILTER_CONFIG, APP_CONFIG.MSS54HP.INTERPOLATION_TABLE, lambdaLimits ?? undefined);
    return { raw, processed };
}

/** Which of the registry's channels the log carries — the same test the app's column list uses.
 *  Channels TUNER derives while reading (`source: 'derived'`) are not something the log carried. */
export function channelsIn(raw: LogDataPoint[]) {
    return (Object.keys(LOG_FIELD_REGISTRY) as FieldKey[])
        .filter(k => LOG_FIELD_REGISTRY[k].source !== 'derived' && isFieldPresent(k, raw))
        .map(k => ({ key: k, symbol: LOG_FIELD_REGISTRY[k].symbol, name: LOG_FIELD_REGISTRY[k].name, unit: LOG_FIELD_REGISTRY[k].unit }));
}

/**
 * `veCalcOptionsFor(cfg, egt, writeRfKorr = false, curves)` then `useVeCalculation.runCalculation`,
 * in its order: annotate, tune rf_korr, calculateNewVEMap.
 */
export function runVe(b: Base, processed: ProcessedLog) {
    const cfg = DEFAULT_FILTER_CONFIG;
    const options = {
        rfKorrSource: cfg.rfKorrSource,
        rfKorrMode: cfg.rfKorrMode,
        applyRfKorr: cfg.applyRfKorr,
        writeRfKorr: false,
        veMethod: cfg.veMethod,
        directAuthority: cfg.directAuthority,
        rfKorrSettleSec: cfg.rfKorrSettleSec,
        ...(cfg.enableVeCellGate === false
            ? { minCellSamples: 1, minCellWeight: 0 }
            : { minCellSamples: cfg.minVeCellSamples, minCellWeight: cfg.minVeCellWeight }),
        normaliseTo: cfg.normaliseChargeTemp ? b.curves : null,
        rfKorrAir: { curves: b.curves, assumedPressureMbar: cfg.assumedAmbientPressure },
        rfKorrThresholds: cfg.enableRfKorrCellGate === false
            ? { minCellSamples: 1, minCellWeight: 0 }
            : { minCellSamples: cfg.rfKorrMinCellSamples, minCellWeight: cfg.rfKorrMinCellWeight },
        egt: b.egt,
    };
    const calc = new VECalculator();
    const annotated = calc.annotateRfKorr(b.map, processed.data, options.egt, options.rfKorrAir, processed.rawData);
    const annotatedForRfKorr = calc.annotateRfKorr(b.map, processed.rfKorrData, options.egt, options.rfKorrAir, processed.rawData);
    const rfKorr: RfKorrTuneResult | null = options.egt
        ? tuneRfKorrTable(b.map, annotatedForRfKorr, options.egt,
            { rpm: APP_CONFIG.MSS54HP.AXIS_RPM, load: APP_CONFIG.MSS54HP.AXIS_LOAD }, options.rfKorrThresholds ?? {})
        : null;
    const ve = calc.calculateNewVEMap(b.map, annotated, { ...options, tunedRfKorr: rfKorr });
    const coverage = buildCoverage({
        hitMap: ve.hitMap, weightMap: ve.weightMap, correctionMap: ve.correctionMap, rejectMap: ve.rejectMap,
        rows: b.map.data.length, cols: b.map.data[0].length,
    });
    return { ve, rfKorr, coverage, census: coverageCensus(coverage) };
}

/** DOWNLOAD TUNED: `useBinaryFile.buildPatchedBuffer(newMap)` with no overrides and every extra off. */
export function buildTuned(b: Base, newMap: VEMap | null): Uint8Array {
    const patcher = new BinaryPatcher(b.base);
    const written = writtenVeGrid(newMap?.data ?? null, null);
    if (written) patcher.setVETableData(written);
    if (b.toggles.applyPatch) patcher.disableMapCorrection(); else patcher.enableMapCorrection();
    patcher.setWOTThreshold(b.toggles.applyWotDisable);
    patcher.setTankVentDisable(b.toggles.applyTankVentDisable);
    patcher.setRfKorrGateFloor(!!b.toggles.applyRfKorrGateDrop);
    patcher.applyChecksumCorrection();
    return new Uint8Array(patcher.getBuffer());
}

export const AXES = { rpm: APP_CONFIG.MSS54HP.AXIS_RPM, load: APP_CONFIG.MSS54HP.AXIS_LOAD };
