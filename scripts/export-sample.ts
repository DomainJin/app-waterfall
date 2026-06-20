// Export a sample 8 m valve .bin using the REAL codec, for byte verification.
// 8 m -> valve_cols = 320, B = ceil(320/8) = 40, row_interval = 16 ms.
// Pattern: a diagonal sweep — row i opens valve i (0..319).
import { writeFileSync } from 'node:fs';
import { buildAnimationGrid } from '../src/codec/valveBin';

const VALVE_COLS = 320; // 8 m × 40 valves/m
const B = Math.ceil(VALVE_COLS / 8); // 40
const ROW_MS = 16;

const rows = Array.from({ length: VALVE_COLS }, (_, i) => [i]);
const bin = buildAnimationGrid(rows, ROW_MS, B, VALVE_COLS);

writeFileSync('sample_8m_diagonal.bin', bin);

const hex = (buf: Uint8Array, n: number) =>
  [...buf.slice(0, n)].map((b) => b.toString(16).padStart(2, '0')).join(' ');

const frameCount = 3 + rows.length; // CONFIG + RESET + START + rows ... + sentinel (rows length used loosely)
console.log(`sample_8m_diagonal.bin written`);
console.log(`  valve_cols=${VALVE_COLS}  B=${B}  row_ms=${ROW_MS}`);
console.log(`  total bytes = ${bin.length}`);
console.log(`  = CONFIG(6) + RESET(${4 + B}) + START(${4 + B}) + ${rows.length}×${4 + B} + sentinel(${4 + B})`);
console.log(`  first 22 bytes: ${hex(bin, 22)}`);
console.log(`    CONFIG  = ${hex(bin.subarray(0, 6), 6)}   (FD FF FF FF | 40 01 = 320 LE)`);
console.log(`    RESET   = ${hex(bin.subarray(6, 6 + 4 + B), 5)} ...`);
console.log(`    START   = ${hex(bin.subarray(6 + 4 + B, 6 + 2 * (4 + B)), 5)} ...`);
void frameCount;
