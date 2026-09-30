import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The practice files shipped in the package, so an assistant can show a command working before the
 * owner has files of their own. Both are already public in the TUNER repository: the BIN is the CSL
 * 0401 Community Patch v1 partial the E46 M3 community publishes openly (TUNER's PRACTICE serves it),
 * and the log is a PRACTICE drive over it written through TUNER's own exporter.
 *
 * Resolved from the bundle's own location: dist/ sits next to samples/ in the published package.
 */
const here = path.dirname(fileURLToPath(import.meta.url));

export const SAMPLE = {
    bin: path.join(here, '..', 'samples', 'practice.bin'),
    log: path.join(here, '..', 'samples', 'practice-drive.testo.csv'),
    /** M35080's test fixture (made-up mileage and VIN), written at build time. */
    m35080: path.join(here, '..', 'samples', 'practice-m35080.bin'),
};
