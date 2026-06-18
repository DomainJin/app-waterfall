import { describe, expect, it } from 'vitest';
import { TS_CONFIG } from '../src/codec/valveBin';
import {
  applyPaint,
  buildValveBin,
  gridToEvents,
  gridToRows,
  sampleFrameToGrid,
  thresholdGrid,
  type FrameLike,
} from '../src/core/layers/valve';

// Split a valve stream into frames, dispatching on the leading ts (CONFIG = 6
// bytes, otherwise 4 + B) — the same logic the firmware uses.
const tsOf = (f: Uint8Array) =>
  (f[0] | (f[1] << 8) | (f[2] << 16) | (f[3] << 24)) >>> 0;

function parseStream(stream: Uint8Array, B: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  let i = 0;
  while (i < stream.length) {
    const len = tsOf(stream.subarray(i)) === (TS_CONFIG >>> 0) ? 6 : 4 + B;
    out.push(stream.slice(i, i + len));
    i += len;
  }
  return out;
}

// Build a synthetic RGBA frame.
function makeFrame(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number],
): FrameLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

const halfWhite = makeFrame(4, 2, (x) =>
  x < 2 ? [255, 255, 255] : [0, 0, 0],
);

describe('sampleFrameToGrid', () => {
  it('area-averages into cols×rows, normalized 0..1', () => {
    const g = sampleFrameToGrid(halfWhite, 2, 1);
    expect(g[0]).toBeCloseTo(1, 5); // left cell white
    expect(g[1]).toBeCloseTo(0, 5); // right cell black
  });

  it('mid-gray -> ~0.5', () => {
    const gray = makeFrame(2, 2, () => [128, 128, 128]);
    expect(sampleFrameToGrid(gray, 1, 1)[0]).toBeCloseTo(128 / 255, 3);
  });

  it('degenerate dims -> zeros', () => {
    expect([...sampleFrameToGrid(halfWhite, 0, 1)]).toEqual([]);
  });
});

describe('thresholdGrid', () => {
  it('intensity >= threshold -> on', () => {
    const out = thresholdGrid(new Float32Array([0.8, 0.5, 0.2]), 0.5);
    expect([...out]).toEqual([1, 1, 0]);
  });
});

describe('applyPaint', () => {
  it('overrides force cells on/off, others unchanged; input not mutated', () => {
    const bool = new Uint8Array([0, 1, 0, 1]);
    const out = applyPaint(bool, { 0: true, 3: false });
    expect([...out]).toEqual([1, 1, 0, 0]);
    expect([...bool]).toEqual([0, 1, 0, 1]); // unchanged
  });
});

describe('gridToRows', () => {
  it('lists open valves per row', () => {
    // 3 cols × 2 rows: row0 = [0,2], row1 = [1]
    const bool = new Uint8Array([1, 0, 1, 0, 1, 0]);
    expect(gridToRows(bool, 3, 2)).toEqual([
      [0, 2],
      [1],
    ]);
  });
});

describe('gridToEvents', () => {
  it('open/close transitions per column; trailing-on closes at end', () => {
    // 1 col × 3 rows, on for rows 0..1 then off
    const bool = new Uint8Array([1, 1, 0]);
    expect(gridToEvents(bool, 1, 3, 80)).toEqual([
      { t_ms: 0, valve: 0, on: true },
      { t_ms: 160, valve: 0, on: false },
    ]);
  });

  it('column on through the end closes at rows*row_ms', () => {
    const bool = new Uint8Array([0, 1]); // 1 col × 2 rows, on at row1
    expect(gridToEvents(bool, 1, 2, 50)).toEqual([
      { t_ms: 50, valve: 0, on: true },
      { t_ms: 100, valve: 0, on: false },
    ]);
  });
});

describe('buildValveBin (integration with a mock source)', () => {
  const frameAt = async () => halfWhite; // left valve on, right off, every row

  it('grid mode: RESET, CONFIG(cols), START, rows…, sentinel', async () => {
    const bin = await buildValveBin({
      frameAt,
      cols: 2,
      rows: 2,
      row_ms: 80,
      B: 1,
      threshold: 0.5,
      mode: 'grid',
    });
    const fs = parseStream(bin, 1);
    // RESET, CONFIG, START, row0, row1, sentinel
    expect(fs.length).toBe(6);
    expect(tsOf(fs[1])).toBe(TS_CONFIG >>> 0);
    expect(fs[1][4] | (fs[1][5] << 8)).toBe(2); // valve_count = cols
    expect(fs[3][4]).toBe(0x80); // row0: valve 0 on
    expect(fs[4][4]).toBe(0x80); // row1: valve 0 on
  });

  it('smooth mode merges the two on-rows into one open/close', async () => {
    const bin = await buildValveBin({
      frameAt,
      cols: 2,
      rows: 2,
      row_ms: 80,
      B: 1,
      threshold: 0.5,
      mode: 'smooth',
    });
    const fs = parseStream(bin, 1);
    // RESET, CONFIG, START, t0(open), t160(close), sentinel
    expect(fs.length).toBe(6);
    expect(tsOf(fs[1])).toBe(TS_CONFIG >>> 0);
  });

  it('no source -> all data frames all-off', async () => {
    const bin = await buildValveBin({
      frameAt: async () => null,
      cols: 8,
      rows: 3,
      row_ms: 40,
      B: 1,
      threshold: 0.5,
      mode: 'grid',
    });
    for (const f of parseStream(bin, 1)) {
      if (f.length === 5) expect(f[4]).toBe(0x00); // data/control payload all 0
    }
  });

  it('paint overrides take effect in the export', async () => {
    const bin = await buildValveBin({
      frameAt: async () => null, // nothing on from video
      cols: 2,
      rows: 1,
      row_ms: 80,
      B: 1,
      threshold: 0.5,
      paint: { 1: true }, // force valve 1 (col 1) on at row 0
      mode: 'grid',
    });
    const fs = parseStream(bin, 1);
    // RESET, CONFIG, START, row0, sentinel -> row0 = fs[3]
    expect(fs[3][4]).toBe(0x40); // valve 1 -> 0x40
  });
});
