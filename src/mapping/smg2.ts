/**
 * E46M3SMG2 /// MAPPING's reading of an SMG II 510 image, headless.
 *
 * Every function the bytes pass through is the app's own, from the SMG2 repository at the commit
 * `vendor/smg2` is pinned to: the XDF engine, SMG2's corrections to the MS4X definition (its
 * catalog), the checksum and the ZB anchor. What is re-composed here is `loadDefinition`
 * (src/lib/definitions.ts there), because the app fetches the definition from its own origin and
 * this has to take it from a path. `npm run verify:smg2` holds this to the app's own
 * `loadDefinition`, item by item, wherever the definition and a real image are on hand.
 *
 * The definition itself is MS4X's and is not ours to ship. The owner brings it; without it this can
 * still say what an image is, and whether its checksums hold.
 */
import {
    applyOverlay, decodeItem, parseXdf, validateXdf,
    type DecodedItem, type XdfDefinition, type XdfFinding, type XdfItem,
} from '@tsunagi/xdf-engine';
import { CALIBRATION_WINDOW, FULL_IMAGE_LENGTH, verifyAllChecksums } from '@tsunagi/ds2-smg2';
import { CATALOG_VERSION, SMG2_OVERLAY } from '@smg2/lib/smg2-catalog';
import { variantForLength, describeUnknownLength, type DefinitionVariant } from '@smg2/lib/definitions';
import { zbFromImage } from '@smg2/lib/workspace';
import { kindOf } from '@smg2/lib/calibration/run';
import { diffItems } from '@smg2/lib/calibration/compare';
import { buildPracticeImage, PRACTICE_IDENTITY } from '@smg2/lib/practiceEcu';
import { InputError } from './tuner';

export { CATALOG_VERSION, kindOf, buildPracticeImage, PRACTICE_IDENTITY };
export type { DecodedItem, DefinitionVariant, XdfDefinition, XdfItem };

/** What an image is, from its length alone — the app's own rule (definitions.ts). */
export function scopeOf(image: Uint8Array): { variant: DefinitionVariant | null; imageBase: number; note: string | null } {
    const variant = variantForLength(image.byteLength);
    return {
        variant,
        // The window is the slice 0x32000.. of the full flash; checksums are addressed absolutely.
        imageBase: variant === 'partial-24k' ? CALIBRATION_WINDOW.start : 0,
        note: variant ? null : describeUnknownLength(image.byteLength),
    };
}

export function identify(image: Uint8Array) {
    const scope = scopeOf(image);
    return {
        bytes: image.byteLength,
        variant: scope.variant,
        note: scope.note,
        // The ZB block sits at 0x2FF94, below the calibration window: only a full read carries it.
        zb: image.byteLength === FULL_IMAGE_LENGTH ? zbFromImage(image) : null,
        checksums: scope.variant ? verifyAllChecksums(image, scope.imageBase) : [],
    };
}

export interface LoadedXdf {
    variant: DefinitionVariant;
    definition: XdfDefinition;
    findings: readonly XdfFinding[];
    added: ReadonlySet<string>;
    title: string;
}

/**
 * `loadDefinition(variant)` with the definition's text handed in instead of fetched: parse, apply
 * SMG2's catalog, validate against the image length, and drop the overlaps the catalog declares
 * deliberate — in that order, as there.
 *
 * One more check the app does not need, because the app picks the file itself: the definition has
 * to be the variant the image is. The two MS4X files differ only in BASEOFFSET, and the wrong one
 * reads bytes that exist, decode as numbers, and are not the numbers.
 */
export function loadXdf(source: string, variant: DefinitionVariant): LoadedXdf {
    let overlaid;
    try {
        overlaid = applyOverlay(parseXdf(source), SMG2_OVERLAY);
    } catch (e) {
        throw new InputError(`This XDF could not be read as the MS4X SMG II 510 definition: ${(e as Error).message}`);
    }
    const definition = overlaid.definition;
    const want = variant === 'partial-24k'
        ? { offset: CALIBRATION_WINDOW.start, subtract: true }
        : { offset: 0, subtract: false };
    const got = definition.header.baseOffset;
    const same = got.offset === want.offset && (want.offset === 0 || got.subtract === want.subtract);
    if (!same) {
        throw new InputError(
            `This image is the ${variant === 'partial-24k' ? '24 KiB calibration window' : 'full 512 KiB flash'}, `
            + `and the XDF given is the other variant (BASEOFFSET ${got.subtract ? '-' : ''}0x${got.offset.toString(16).toUpperCase()}). `
            + `Use Siemens_SMG_II_510_${variant === 'partial-24k' ? '24K' : '512K'}.xdf.`);
    }
    const imageLength = variant === 'partial-24k' ? CALIBRATION_WINDOW.length : FULL_IMAGE_LENGTH;
    const aliasKeys = new Set(overlaid.aliases.map(([a, b]) => [a, b].sort().join('|')));
    return {
        variant,
        definition,
        added: overlaid.added,
        title: definition.header.title,
        findings: validateXdf(definition, { imageLength, source }).filter(f => {
            if (f.kind !== 'value-overlap' || f.items.length !== 2) return true;
            return !aliasKeys.has([...f.items].sort().join('|'));
        }),
    };
}

export function decodeAll(x: LoadedXdf, image: Uint8Array): { item: XdfItem; decoded: DecodedItem | null; error: string | null }[] {
    return x.definition.items.map(item => {
        try {
            return { item, decoded: decodeItem(x.definition, image, item), error: null };
        } catch (e) {
            return { item, decoded: null, error: (e as Error).message };
        }
    });
}

export function diffAll(x: LoadedXdf, a: Uint8Array, b: Uint8Array) {
    return diffItems(x.definition, a, b, x.definition.items);
}
