import { TS_RESET, TS_START } from './constants';
import { packConfigFrame, packFrame, valveBits } from './pack';
import type { ValveEvent } from './types';

// Stream builders — PURE. Stream order (firmware handoff §3):
//   RESET → CONFIG(valve_count) → START → data frames (ts ascending) → all-off sentinel.
//
// CONFIG is a 6-byte frame; data frames are 4 + B bytes. The stream is therefore
// NOT a uniform frame size — a reader must dispatch on the leading u32 ts
// (TS_CONFIG => 6 bytes, otherwise 4 + B).

function concat(frames: Uint8Array[]): Uint8Array {
  const total = frames.reduce((n, f) => n + f.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const f of frames) {
    out.set(f, off);
    off += f.length;
  }
  return out;
}

/**
 * Grid mode: every valve in a row shares ts = row × row_ms. One frame per row.
 * @param rows        rows[i] = list of 0-indexed open valves at row i
 * @param valveCount  declared in the CONFIG frame (= valve_cols from geometry)
 */
export function buildAnimationGrid(
  rows: number[][],
  row_ms: number,
  B: number,
  valveCount: number,
): Uint8Array {
  const frames: Uint8Array[] = [
    packFrame(TS_RESET, new Uint8Array(B)),
    packConfigFrame(valveCount), // declare dynamic valve_count right after RESET
    packFrame(TS_START, new Uint8Array(B)),
  ];
  rows.forEach((openValves, i) => {
    frames.push(packFrame(i * row_ms, valveBits(openValves, B)));
  });
  // Sentinel: all valves off, one row_ms past the last data row.
  frames.push(packFrame(rows.length * row_ms, new Uint8Array(B)));
  return concat(frames);
}

/**
 * Smooth mode: per-valve sub-frame timing. Events are sorted by (ts, then
 * opens before closes at the same ts); a cumulative state snapshot is emitted
 * at each distinct ts. Sentinel (all-off) is at lastTs + row_ms.
 * @param valveCount  declared in the CONFIG frame (= valve_cols from geometry)
 */
export function buildAnimationSmooth(
  events: ValveEvent[],
  row_ms: number,
  B: number,
  valveCount: number,
): Uint8Array {
  const sorted = events
    .slice()
    .sort((a, b) => a.t_ms - b.t_ms || (a.on === b.on ? 0 : a.on ? -1 : 1));

  const frames: Uint8Array[] = [
    packFrame(TS_RESET, new Uint8Array(B)),
    packConfigFrame(valveCount),
    packFrame(TS_START, new Uint8Array(B)),
  ];

  const state = new Uint8Array(B);
  const maxValve = B * 8;
  let i = 0;
  let lastT = 0;
  while (i < sorted.length) {
    const t = sorted[i].t_ms;
    while (i < sorted.length && sorted[i].t_ms === t) {
      const { valve, on } = sorted[i];
      if (valve >= 0 && valve < maxValve) {
        const byte = valve >> 3;
        const mask = 1 << (7 - (valve & 7));
        if (on) state[byte] |= mask;
        else state[byte] &= ~mask;
      }
      i++;
    }
    frames.push(packFrame(t, state.slice())); // snapshot current cumulative state
    lastT = t;
  }

  frames.push(packFrame(lastT + row_ms, new Uint8Array(B))); // all-off sentinel
  return concat(frames);
}
