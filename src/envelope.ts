/**
 * The shape every result takes, whichever tool computed it: a `summary` to say, the numbers, where
 * they came from, and — only where the result is acted on in an app — how.
 */
import { MATRIX } from './facts';
import type { Apply } from './facts';

declare const __TUNER_VERSION__: string;
declare const __TUNER_COMMIT__: string;
declare const __SMG2_VERSION__: string;
declare const __SMG2_COMMIT__: string;
declare const __BOOT_VERSION__: string;
declare const __BOOT_COMMIT__: string;
declare const __M35080_VERSION__: string;
declare const __M35080_COMMIT__: string;

export interface Source {
    tool: string;
    version: string;
    commit: string;
    stage: 'stable' | 'experimental';
    note?: { en: string; ja: string };
    /** SMG2 only: SMG2's corrections to the MS4X definition, and which definition was read. */
    definition?: { catalog: string; xdf: string | null };
}

export interface Envelope<T> {
    matrix: typeof MATRIX;
    category: 'MAPPING' | 'MIGRATION';
    command: string;
    summary: string;
    source: Source;
    result: T;
    apply?: Apply;
}

export const TOOL_BUILD = {
    tuner: () => ({ version: __TUNER_VERSION__, commit: __TUNER_COMMIT__ }),
    smg2: () => ({ version: __SMG2_VERSION__, commit: __SMG2_COMMIT__ }),
    boot: () => ({ version: __BOOT_VERSION__, commit: __BOOT_COMMIT__ }),
    m35080: () => ({ version: __M35080_VERSION__, commit: __M35080_COMMIT__ }),
};

export const envelope = <T>(command: string, summary: string, source: Source, result: T, apply?: Apply, category: Envelope<T>['category'] = 'MAPPING'): Envelope<T> => ({
    matrix: MATRIX, category, command, summary, source, result, ...(apply ? { apply } : {}),
});
