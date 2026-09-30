/**
 * matrix-tsunagi — TSUNAGI///Matrix's calculations as a library.
 *
 *     import { mapping, describe } from 'matrix-tsunagi';
 *     const ve = mapping.proposeVe({ bin, csv });   // bin: Uint8Array, csv: string
 *     console.log(ve.summary);
 *
 * Categories follow the apps' marks. MAPPING holds TUNER (mapping.readBin, readLog, proposeVe,
 * proposeRfKorr) and SMG2 (mapping.smg2Image, smg2Read, smg2Compare). MIGRATION reads, and only
 * reads, BOOT's DME backups and M35080 cluster EEPROMs (migration.bootBackup, bootCompare,
 * m35080Read, m35080Compare).
 */
import * as mapping from './mapping';
import * as migration from './migration';

export { mapping, migration };
export { describe } from './describe';
export { ABOUT, APPS, MATRIX, MESH_URL } from './facts';
export { SAMPLE } from './samples';
