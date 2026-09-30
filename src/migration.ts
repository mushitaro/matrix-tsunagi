/**
 * MIGRATION — the Matrix category for tools that move what a car carries to another part:
 * MSS54HP CSL CONVERT /// BOOT (the DME's bootloader, onto the CSL program) and
 * E46 M35080 /// MIGRATION (the cluster's EEPROM, onto a replacement).
 *
 * READ ONLY, deliberately. Both tools' repositories also hold the functions that BUILD a changed
 * image — a converted bootloader, an odometer or VIN written into an EEPROM — and none of them is
 * imported here, so none is in the bundle (verify:migration checks the bundle for their names).
 * Changing those bytes is the apps' job, behind their own guards.
 *
 * Two things never leave these functions, because a result is read by an assistant and so leaves
 * the owner's machine in the conversation: the VIN (an EEPROM carries it twice; a DME backup carries
 * an identity record) and the DME's identity text. What IS reported is what the owner asked about:
 * which bootloader, whether the CRCs hold, the mileage, whether the VIN copies agree.
 */
import {
    extractSa0, verifyBootloaderCrc, identifyBootloader, masterProgramNumbers, conversionStages, diffOffsets,
    type BootloaderFlavour,
} from '@boot/bootloaderImage';
import { FULL_IMAGE_LENGTH as DME_IMAGE_LENGTH, describeImageOffsets, type Processor } from '@boot/imageLayout';
import { practiceEcuImage } from '@boot/practiceEcu';
import { IMAGE_SIZE as EEPROM_SIZE, verdictFor, secureOf, diff as eepromDiff, regionOf } from '@m35080/lib/domain/image';
import { decodeOdometer } from '@m35080/lib/domain/odometer';
import { detectLayout } from '@m35080/lib/domain/layout';
import { readVins } from '@m35080/lib/domain/vin';
import { InputError } from './mapping/tuner';
import { APPLY_BOOT, APPLY_M35080, APPS } from './facts';
import { envelope, TOOL_BUILD } from './envelope';
import type { Source } from './envelope';

export { InputError, practiceEcuImage };

const bootSource = (): Source => ({ tool: APPS.boot.name, ...TOOL_BUILD.boot(), stage: 'stable' });
const m35080Source = (): Source => ({ tool: APPS.m35080.name, ...TOOL_BUILD.m35080(), stage: 'stable' });
const hex = (v: number, w = 4) => '0x' + v.toString(16).toUpperCase().padStart(w, '0');
const n = (v: number) => v.toLocaleString('en-US');
const FLAVOUR = { 'standard-m3': 'the standard M3 bootloader', csl: 'the CSL bootloader', unknown: 'a bootloader matching neither known image' } as const;

// ------------------------------------------------------------------------------------------------
// BOOT

export interface BootBackupInput { image: Uint8Array; practice?: boolean }

function needsDmeImage(image: Uint8Array) {
    if (image.byteLength !== DME_IMAGE_LENGTH) {
        throw new InputError(`Expected the ${n(DME_IMAGE_LENGTH)}-byte full MSS54HP image (master and slave, 512 KiB each) that BOOT backs up; this file is ${n(image.byteLength)} bytes. A 64 KB calibration partial is TUNER's: use matrix-tsunagi mapping bin.`);
    }
}

function bootloaderOf(image: Uint8Array, processor: Processor) {
    const sa0 = extractSa0(image, processor);
    const crc = verifyBootloaderCrc(sa0, processor);
    return {
        flavour: identifyBootloader(sa0, processor) as BootloaderFlavour,
        crc: { stored: hex(crc.stored), computed: hex(crc.computed), valid: crc.valid },
        ...(processor === 'master' ? { programNumbers: masterProgramNumbers(sa0) } : {}),
    };
}

/** Which bootloader each processor carries, whether its CRC holds, and what the CSL conversion has left to do. */
export function bootBackup({ image, practice = false }: BootBackupInput) {
    needsDmeImage(image);
    const master = bootloaderOf(image, 'master');
    const slave = bootloaderOf(image, 'slave');
    const stages = conversionStages(master.flavour, slave.flavour);
    const programs = [...new Set(master.programNumbers ?? [])];
    const summary = [
        practice ? 'PRACTICE image: built by BOOT\'s practice device, not read from any car.' : '',
        `A full MSS54HP image. The master carries ${FLAVOUR[master.flavour]}${master.crc.valid ? '' : ' (its CRC does NOT hold)'}, the slave ${FLAVOUR[slave.flavour]}${slave.crc.valid ? '' : ' (its CRC does NOT hold)'}.`,
        programs.length === 1 ? `Program number ${programs[0]}.` : programs.length > 1 ? `The master's three program-number copies disagree: ${programs.join(', ')}.` : '',
        stages.blocked
            ? 'A bootloader matches neither known image, so no conversion can be planned from this backup.'
            : stages.next === null
                ? 'Both processors already carry the CSL bootloader: nothing is left to convert.'
                : `The CSL conversion has ${stages.total - stages.done.length} stage(s) left; the next is the ${stages.next} (slave first, as BOOT plans it).`,
        'The DME\'s identity record is not printed.',
    ].filter(Boolean).join(' ');
    return envelope('boot backup', summary, bootSource(), {
        bytes: image.byteLength, master, slave, conversion: stages, practice,
    }, APPLY_BOOT, 'MIGRATION');
}

export interface BootCompareInput { image: Uint8Array; other: Uint8Array }

/** Where two full DME images differ, named by region — e.g. two reads of the same DME, or before and after. */
export function bootCompare({ image, other }: BootCompareInput) {
    needsDmeImage(image);
    needsDmeImage(other);
    const offsets = diffOffsets(image, other);
    const regions = describeImageOffsets(offsets);
    const summary = offsets.length
        ? `${n(offsets.length)} byte(s) differ, in: ${regions.slice(0, 6).join('; ')}${regions.length > 6 ? '; …' : ''}.`
        : 'The two images are identical, byte for byte.';
    return envelope('boot compare', summary, bootSource(), {
        bytesDiffering: offsets.length,
        regions,
        firstOffsets: offsets.slice(0, 32).map(o => hex(o, 5)),
    }, APPLY_BOOT, 'MIGRATION');
}

// ------------------------------------------------------------------------------------------------
// M35080

export interface EepromInput { image: Uint8Array; practice?: boolean }

function needsEeprom(image: Uint8Array) {
    if (image.byteLength !== EEPROM_SIZE) {
        throw new InputError(`Expected a ${n(EEPROM_SIZE)}-byte M35080 image, as E46 M35080 /// MIGRATION backs one up; this file is ${n(image.byteLength)} bytes.`);
    }
}

/** What a cluster EEPROM backup says: whether it is a chip read at all, the mileage, the checksums, whether the VIN copies agree. */
export function m35080Read({ image, practice = false }: EepromInput) {
    needsEeprom(image);
    const verdict = verdictFor(image);
    const odo = decodeOdometer(secureOf(image));
    const layout = detectLayout(image);
    const vins = readVins(image);
    const sums = layout.checksums.map(c => ({ region: c.id, at: hex(c.at, 3), stored: hex(c.stored, 2), computed: hex(c.computed, 2), ok: c.ok, degenerate: c.degenerate }));
    const summary = [
        practice ? 'PRACTICE image: made-up values from the app\'s test fixture, not read from any cluster.' : '',
        verdict.uniform
            ? `Every byte is ${hex(verdict.uniformValue ?? 0, 2)}: this is not a chip read (a dead or shorted bus reads like this), and no mileage can be read from it.`
            : `A 1 KB M35080 image with ${verdict.distinct} distinct byte values.`,
        verdict.uniform ? '' : odo.ok
            ? `The secure counter reads ${n(odo.km)} km${odo.canonical ? '' : ' (in a pattern the app does not write itself)'}.`
            : `The secure counter cannot be read: ${odo.reason}.`,
        verdict.uniform ? '' : layout.kind === 'late'
            ? `Late layout; checksums ${layout.consistent ? 'all hold' : 'do NOT all hold'}.`
            : 'The layout is not recognised: no checksum holds on real data.',
        verdict.uniform ? '' : vins.none ? 'No VIN field was found.' : `VIN field(s) found${vins.differ ? ', and the coded and ASCII copies DISAGREE' : ''}; the VIN itself is not printed.`,
    ].filter(Boolean).join(' ');
    return envelope('m35080 read', summary, m35080Source(), {
        bytes: image.byteLength,
        chipRead: !verdict.uniform,
        distinctByteValues: verdict.distinct,
        secureBlank: verdict.secureBlank,
        odometer: verdict.uniform ? null : odo.ok
            ? { km: odo.km, canonical: odo.canonical }
            : { km: null, reason: odo.reason },
        layout: layout.kind,
        checksums: sums,
        vin: { coded: vins.coded !== null, ascii: vins.ascii !== null, copiesDisagree: vins.differ },
        practice,
    }, APPLY_M35080, 'MIGRATION');
}

export interface EepromCompareInput { image: Uint8Array; other: Uint8Array }

/** Which bytes differ between two cluster EEPROM images, by region — the secure counter, a VIN field, or the standard array. */
export function m35080Compare({ image, other }: EepromCompareInput) {
    needsEeprom(image);
    needsEeprom(other);
    const addresses = eepromDiff(image, other);
    // The VIN fields of either image, so a changed VIN is named as one rather than as "standard".
    const spans = [image, other].flatMap(img => {
        const v = readVins(img);
        return [
            ...(v.coded ? [{ from: v.coded.from, to: v.coded.to, field: 'coded' as const }] : []),
            ...(v.ascii ? [{ from: v.ascii.offset, to: v.ascii.offset + v.ascii.text.length - 1, field: 'ascii' as const }] : []),
        ];
    });
    const byRegion: Record<string, number> = {};
    for (const a of addresses) { const r = regionOf(a, spans); byRegion[r] = (byRegion[r] ?? 0) + 1; }
    const a = decodeOdometer(secureOf(image));
    const b = decodeOdometer(secureOf(other));
    const summary = addresses.length
        ? `${addresses.length} byte(s) differ: ${Object.entries(byRegion).map(([r, c]) => `${c} in the ${r} area`).join(', ')}.${a.ok && b.ok && a.km !== b.km ? ` The mileage reads ${n(a.km)} km in the first and ${n(b.km)} km in the second.` : ''}`
        : 'The two images are identical, byte for byte.';
    return envelope('m35080 compare', summary, m35080Source(), {
        bytesDiffering: addresses.length,
        byRegion,
        addresses: addresses.slice(0, 64).map(x => hex(x, 3)),
        odometer: { first: a.ok ? a.km : null, second: b.ok ? b.km : null },
    }, APPLY_M35080, 'MIGRATION');
}
