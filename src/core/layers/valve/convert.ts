import type { ValveEvent } from '../../../codec/valveBin';

// Convert a boolean valve grid (rows = time, cols = space) into the codec's
// input shapes. PURE.

/** Grid mode: rows[r] = list of 0-indexed open valves at row r. */
export function gridToRows(
  bool: Uint8Array,
  cols: number,
  rows: number,
): number[][] {
  const result: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const open: number[] = [];
    for (let c = 0; c < cols; c++) {
      if (bool[r * cols + c]) open.push(c);
    }
    result.push(open);
  }
  return result;
}

/**
 * Smooth mode: per-column on/off transitions become open/close events at exact
 * ms (row × row_ms). A column still on at the end closes at rows × row_ms.
 */
export function gridToEvents(
  bool: Uint8Array,
  cols: number,
  rows: number,
  row_ms: number,
): ValveEvent[] {
  const events: ValveEvent[] = [];
  for (let c = 0; c < cols; c++) {
    let prev = false;
    for (let r = 0; r < rows; r++) {
      const cur = bool[r * cols + c] === 1;
      if (cur !== prev) {
        events.push({ t_ms: r * row_ms, valve: c, on: cur });
        prev = cur;
      }
    }
    if (prev) events.push({ t_ms: rows * row_ms, valve: c, on: false });
  }
  return events;
}
