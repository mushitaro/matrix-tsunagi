/**
 * What this package can do, in a form an assistant can read once and then use without guessing.
 * `matrix-tsunagi describe` prints it; the MCP server hands the same text over as its instructions.
 */
import { ABOUT, APPS, MATRIX, MESH_URL } from './facts';

declare const __PKG_VERSION__: string;
declare const __TUNER_VERSION__: string;
declare const __TUNER_COMMIT__: string;

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
] as const;

export function describe() {
    return {
        matrix: MATRIX,
        package: { name: 'matrix-tsunagi', version: __PKG_VERSION__ },
        about: ABOUT,
        categories: [
            {
                name: 'MAPPING',
                tools: [{ name: APPS.tuner.name, version: __TUNER_VERSION__, commit: __TUNER_COMMIT__, publicBuild: APPS.tuner.url }],
                commands: COMMANDS,
                mcp: 'matrix-tsunagi mcp mapping',
            },
        ],
        samples: 'Every --bin/--log pair can be replaced by --sample: a practice BIN (the CSL 0401 Community Patch v1 partial) and a practice drive over it, so the commands can be shown working before the owner has files of their own.',
        inputs: {
            bin: 'The 65,536-byte MSS54HP calibration partial ("0401 partial BIN"), as TUNER reads and writes it.',
            log: 'A CSV with a header row: Testo\'s MSS54 export, or a log TUNER itself exported. Column names are matched as Testo and TUNER spell them; a missing required column is reported by name.',
        },
        output: 'JSON on stdout: summary (say this), result (the numbers), source (which tool, version and commit computed it, and whether the calculation is experimental), apply (present only when the result would have to be written to the car: which app, free or WORKS, and how). Errors are JSON on stderr with exit code 1.',
        mesh: MESH_URL,
    };
}
