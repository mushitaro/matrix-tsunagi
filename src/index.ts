/**
 * matrix-tsunagi — TSUNAGI///Matrix's calculations as a library.
 *
 *     import { mapping, describe } from 'matrix-tsunagi';
 *     const ve = mapping.proposeVe({ bin, csv });   // bin: Uint8Array, csv: string
 *     console.log(ve.summary);
 *
 * Categories follow the apps' marks. MAPPING is the first; the others arrive as their tools do.
 */
import * as mapping from './mapping';

export { mapping };
export { describe } from './describe';
export { ABOUT, APPS, MATRIX, MESH_URL } from './facts';
export { SAMPLE } from './samples';
