/**
 * MAPPING, E46M3SMG2 /// MAPPING: what an SMG II 510 image holds.
 *
 * SMG2 has only a WORKS build, so by the line this package keeps nothing here makes a file: it
 * reads, decodes and compares, and every result points at the WORKS build for the car.
 *
 * Decoding needs the MS4X definition (Siemens_SMG_II_510_24K.xdf / _512K.xdf), which is MS4X's and
 * not shipped here — the owner passes their own. Without it, `smg2Image` still says what the image
 * is: its scope, the ZB number, and whether its checksums hold.
 */
import {
    identify, loadXdf, decodeAll, diffAll, scopeOf, kindOf, buildPracticeImage, CATALOG_VERSION,
    type DecodedItem, type LoadedXdf, type XdfItem,
} from './mapping/smg2';
import { InputError } from './mapping/tuner';
import { APPLY_SMG2, APPS } from './facts';
import { envelope, TOOL_BUILD } from './envelope';
import type { Source } from './envelope';

const source = (xdf: LoadedXdf | null): Source => ({
    tool: APPS.smg2.name,
    ...TOOL_BUILD.smg2(),
    stage: 'stable',
    definition: { catalog: CATALOG_VERSION, xdf: xdf?.title ?? null },
});

const hex = (v: number, w = 4) => '0x' + v.toString(16).toUpperCase().padStart(w, '0');
const round = (v: number, decimals: number | null) => {
    if (!Number.isFinite(v)) return null;
    const d = decimals ?? 4;
    const f = 10 ** Math.min(Math.max(d, 0), 6);
    return Math.round(v * f) / f;
};
const VARIANT_TEXT = { 'partial-24k': 'the 24 KiB calibration window (0x32000-0x37FFF)', 'full-512k': 'the full 512 KiB flash' } as const;

function checksumReadout(image: Uint8Array) {
    return identify(image).checksums.map(c => ({
        area: c.area, address: hex(c.address, 5), stored: hex(c.stored), computed: hex(c.computed), ok: c.ok,
    }));
}

function needsVariant(image: Uint8Array) {
    const scope = scopeOf(image);
    if (!scope.variant) throw new InputError(scope.note ?? 'Not an SMG II 510 image.');
    return scope.variant;
}

// ------------------------------------------------------------------------------------------------

export interface Smg2ImageInput { image: Uint8Array; practice?: boolean }

/** What an SMG II 510 image is — no definition needed. */
export function smg2Image({ image, practice = false }: Smg2ImageInput) {
    const id = identify(image);
    const checks = checksumReadout(image);
    const summary = [
        practice ? 'PRACTICE image: its bytes are invented by the app\'s practice device, and mean nothing about any car.' : '',
        id.variant ? `An SMG II 510 image: ${VARIANT_TEXT[id.variant]}.` : id.note,
        id.zb ? `ZB ${id.zb}.` : id.variant === 'partial-24k' ? 'The ZB number sits below the calibration window, so only a full read carries it.' : '',
        checks.length ? `Checksums: ${checks.map(c => `${c.area} ${c.ok ? 'OK' : 'does NOT match'}`).join(', ')}.` : '',
        id.variant ? 'To decode its tables, pass the MS4X definition with smg2 read --xdf.' : '',
    ].filter(Boolean).join(' ');
    return envelope('smg2 image', summary, source(null), {
        bytes: id.bytes, variant: id.variant, zb: id.zb, checksums: checks, practice,
    }, APPLY_SMG2);
}

// ------------------------------------------------------------------------------------------------

export interface Smg2ReadInput {
    image: Uint8Array;
    /** The MS4X definition's text: Siemens_SMG_II_510_24K.xdf for a window, _512K.xdf for a full read. */
    xdf: string;
    /** A uniqueId (0x7695) or words of a title ("A1 Speed"). Matching items come back in full. */
    item?: string;
    practice?: boolean;
}

function itemRow(entry: { item: XdfItem; decoded: DecodedItem | null; error: string | null }, x: LoadedXdf, full: boolean) {
    const { item, decoded, error } = entry;
    const base = {
        uniqueId: item.uniqueId,
        title: item.title,
        categories: item.categories,
        kind: kindOf(item),
        units: item.kind === 'constant' ? item.units : item.z.units,
        ...(x.added.has(item.uniqueId) ? { addedBySmg2: true } : {}),
    };
    if (!decoded) return { ...base, error };
    if (decoded.kind === 'constant') {
        const d = item.kind === 'constant' ? item.decimals : null;
        const hexOut = item.kind === 'constant' && item.outputType === 3;
        return { ...base, value: hexOut ? hex(decoded.raw) : round(decoded.value, d) };
    }
    const flat = decoded.values.flat().filter(Number.isFinite);
    const summary = {
        ...base,
        shape: [decoded.rows, decoded.cols],
        min: flat.length ? round(Math.min(...flat), decoded.decimals) : null,
        max: flat.length ? round(Math.max(...flat), decoded.decimals) : null,
    };
    if (!full) return summary;
    const axis = (a: typeof decoded.x) => a && {
        units: a.units,
        values: a.values?.map(v => round(v, a.decimals)) ?? null,
        labels: a.labels,
    };
    return {
        ...summary,
        ...(item.description ? { description: item.description } : {}),
        x: axis(decoded.x),
        y: axis(decoded.y),
        values: decoded.values.map(row => row.map(v => round(v, decoded.decimals))),
    };
}

/** Every item the MS4X definition names, decoded through SMG2's corrections. */
export function smg2Read({ image, xdf, item, practice = false }: Smg2ReadInput) {
    const variant = needsVariant(image);
    const x = loadXdf(xdf, variant);
    const all = decodeAll(x, image);
    const q = item?.trim().toLowerCase();
    const matches = q
        ? all.filter(e => e.item.uniqueId.toLowerCase() === q || e.item.title.toLowerCase().includes(q))
        : null;
    if (q && !matches!.length) {
        throw new InputError(`No item's title contains "${item}" and no uniqueId is ${item}. Run smg2 read without --item for the list.`);
    }
    const rows = (matches ?? all).map(e => itemRow(e, x, !!matches));
    const errors = x.findings.filter(f => f.severity === 'error');
    const counts = { constant: 0, curve: 0, map: 0 };
    for (const e of all) counts[kindOf(e.item)]++;
    const summary = [
        practice ? 'PRACTICE image: invented bytes, so these numbers mean nothing about any car.' : '',
        `${VARIANT_TEXT[variant]}, decoded through the MS4X definition with SMG2's corrections (catalog ${CATALOG_VERSION}):`,
        `${all.length} items — ${counts.constant} constants, ${counts.curve} curves, ${counts.map} maps.`,
        matches ? `${matches.length} item${matches.length === 1 ? '' : 's'} matching "${item}" in full.` : 'Pass --item with words of a title or a uniqueId for an item\'s full table and axes.',
        errors.length ? `The definition has ${errors.length} error-level finding(s); see result.findings.` : '',
    ].filter(Boolean).join(' ');
    return envelope('smg2 read', summary, source(x), {
        variant,
        items: rows,
        findings: x.findings.map(f => ({ severity: f.severity, kind: f.kind, message: f.message, items: f.items })),
        practice,
    }, APPLY_SMG2);
}

// ------------------------------------------------------------------------------------------------

export interface Smg2CompareInput { image: Uint8Array; other: Uint8Array; xdf: string }

/** Which items differ between two images of the same scope, and by how much. */
export function smg2Compare({ image, other, xdf }: Smg2CompareInput) {
    const variant = needsVariant(image);
    if (other.byteLength !== image.byteLength) {
        throw new InputError(`The two images are different lengths (${image.byteLength.toLocaleString()} and ${other.byteLength.toLocaleString()} bytes), so they are not the same read of the calibration.`);
    }
    const x = loadXdf(xdf, variant);
    const diffs = diffAll(x, image, other).map(d => ({
        uniqueId: d.item.uniqueId,
        title: d.item.title,
        categories: d.item.categories,
        kind: kindOf(d.item),
        cellsChanged: d.cellsChanged,
        largestDifference: d.maxDelta === null ? null : round(d.maxDelta, 4),
        units: d.item.kind === 'constant' ? d.item.units : d.item.z.units,
    }));
    const summary = diffs.length
        ? `${diffs.length} of ${x.definition.items.length} items differ between the two images: ${diffs.slice(0, 5).map(d => `${d.title} (${d.cellsChanged} cell${d.cellsChanged === 1 ? '' : 's'})`).join(', ')}${diffs.length > 5 ? ', …' : ''}.`
        : `The two images hold the same values in all ${x.definition.items.length} items the definition names.`;
    return envelope('smg2 compare', summary, source(x), { variant, differs: diffs }, APPLY_SMG2);
}

export { buildPracticeImage };
