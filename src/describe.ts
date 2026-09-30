/**
 * What this package can do, in a form an assistant can read once and then use without guessing.
 * `matrix-tsunagi describe` prints it; the MCP server hands the same text over as its instructions.
 */
import { ABOUT, APPS, MATRIX, MESH_URL } from './facts';

declare const __PKG_VERSION__: string;
declare const __TUNER_VERSION__: string;
declare const __TUNER_COMMIT__: string;
declare const __SMG2_VERSION__: string;
declare const __SMG2_COMMIT__: string;

export const COMMANDS = [
    {
        command: 'matrix-tsunagi mapping bin <file.bin>',
        answers: 'What is in a 64 KB MSS54HP calibration partial: checksums, logic patches (MAP, TANK VENT, WOT TH, RF GATE), how far the VE and warm-up tables are from stock, the VE table itself.',
        stage: 'stable',
        writesFile: false,
    },
    {
        command: 'matrix-tsunagi mapping log <file.csv> [--bin <file.bin>]',
        answers: 'What a drive log (Testo CSV, or a CSV TUNER exported) carries, how many rows the VE and rf_korr calculations can use, and why the rest were left out — each reason with what to change on the next drive.',
        stage: 'stable',
        writesFile: false,
    },
    {
        command: 'matrix-tsunagi mapping ve --bin <file.bin> --log <file.csv> [--out <tuned.bin>]',
        answers: 'The VE (alpha-N) map the drive supports: which cells change and by how much, which need more driving and how, and — with --out — the tuned BIN, checksums corrected, byte-for-byte what TUNER\'s DOWNLOAD TUNED gives.',
        stage: 'stable',
        writesFile: true,
    },
    {
        command: 'matrix-tsunagi mapping rfkorr --bin <file.bin> --log <file.csv>',
        answers: 'The rf_korr table (KF_RF_KORR_DRREL, exhaust-temperature density correction) the drive supports, with the evidence per cell. Experimental in the app; values only — the WORKS build makes the file.',
        stage: 'experimental',
        writesFile: false,
    },
    {
        command: 'matrix-tsunagi mapping smg2 image <image.bin>',
        answers: 'What an SMG II 510 (E46 M3 SMG gearbox ECU) image is: the 24 KiB calibration window or the full 512 KiB flash, its ZB number, and whether its CRC checksums hold. Needs no definition.',
        stage: 'stable',
        writesFile: false,
    },
    {
        command: 'matrix-tsunagi mapping smg2 read <image.bin> --xdf <Siemens_SMG_II_510_24K.xdf|_512K.xdf> [--item <title words or uniqueId>]',
        answers: "Every calibration item the MS4X definition names (shift speed thresholds per gear and program, gear ratios, clutch and launch settings…), decoded through E46M3SMG2 /// MAPPING's corrections. --item returns one item's full table and axes. The XDF is the owner's own.",
        stage: 'stable',
        writesFile: false,
    },
    {
        command: 'matrix-tsunagi mapping smg2 compare <a.bin> <b.bin> --xdf <definition.xdf>',
        answers: 'Which calibration items differ between two SMG II images, how many cells, and the largest difference.',
        stage: 'stable',
        writesFile: false,
    },
] as const;

export function describe() {
    return {
        matrix: MATRIX,
        package: { name: 'matrix-tsunagi', version: __PKG_VERSION__ },
        about: ABOUT,
        categories: [
            {
                name: 'MAPPING',
                tools: [
                    { name: APPS.tuner.name, version: __TUNER_VERSION__, commit: __TUNER_COMMIT__, publicBuild: APPS.tuner.url },
                    { name: APPS.smg2.name, version: __SMG2_VERSION__, commit: __SMG2_COMMIT__, publicBuild: null, works: true },
                ],
                commands: COMMANDS,
                mcp: 'matrix-tsunagi mcp mapping',
            },
        ],
        samples: "Every TUNER --bin/--log pair can be replaced by --sample: a practice BIN (the CSL 0401 Community Patch v1 partial) and a practice drive over it. smg2 image and smg2 read take --sample for SMG2's practice image, whose bytes are invented. Both show the commands working before the owner has files of their own.",
        inputs: {
            bin: 'The 65,536-byte MSS54HP calibration partial ("0401 partial BIN"), as TUNER reads and writes it.',
            log: 'A CSV with a header row: Testo\'s MSS54 export, or a log TUNER itself exported. Column names are matched as Testo and TUNER spell them; a missing required column is reported by name.',
            smg2Image: 'An SMG II 510 image: the 24,576-byte calibration window or the 524,288-byte full flash, as E46M3SMG2 /// MAPPING reads and exports them.',
            xdf: "The MS4X Dev Team's TunerPro definition, Siemens_SMG_II_510_24K.xdf or _512K.xdf. Not shipped here; the WORKS build of E46M3SMG2 /// MAPPING carries it.",
        },
        output: 'JSON on stdout: summary (say this), result (the numbers), source (which tool, version and commit computed it, and whether the calculation is experimental), apply (present only when the result would have to be written to the car: which app, free or WORKS, and how). Errors are JSON on stderr with exit code 1.',
        mesh: MESH_URL,
    };
}
