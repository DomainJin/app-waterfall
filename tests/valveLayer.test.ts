import { describe, expect, it } from 'vitest';
import { TS_CONFIG } from '../src/codec/valveBin';
import {
  activeCols,
  applyPaint,
  buildValveBin,
  computeFullGrid,
  frameToValveRow,
  gridToEvents,
  gridToRows,
  maskEdges,
  sampleFrameToGrid,
  sampleScanline,
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

describe('sampleScanline', () => {
  // 1-col-wide, 3-row-tall image: row0=white, row1=black, row2=white.
  const stripes = makeFrame(1, 3, (_x, y) => (y === 1 ? [0, 0, 0] : [255, 255, 255]));

  it('reads ONLY the requested line, not an average over height', () => {
    expect(sampleScanline(stripes, 1, 0)[0]).toBeCloseTo(1, 5); // y=0 -> white
    expect(sampleScanline(stripes, 1, 1 / 3)[0]).toBeCloseTo(0, 5); // y=1 -> black
    expect(sampleScanline(stripes, 1, 2 / 3)[0]).toBeCloseTo(1, 5); // y=2 -> white
  });

  it('averaging the same image over its full height would hide this (sanity check)', () => {
    // Confirms the three lines really do differ — sampleFrameToGrid(img,1,1)
    // collapses them into one indistinguishable value.
    expect(sampleFrameToGrid(stripes, 1, 1)[0]).toBeCloseTo(2 / 3, 5);
  });

  it('degenerate dims -> zeros', () => {
    expect([...sampleScanline(stripes, 0, 0)]).toEqual([]);
  });
});

describe('thresholdGrid', () => {
  it('intensity >= threshold -> on', () => {
    const out = thresholdGrid(new Float32Array([0.8, 0.5, 0.2]), 0.5);
    expect([...out]).toEqual([1, 1, 0]);
  });

  it('invert flips the comparison: intensity < threshold -> on', () => {
    const out = thresholdGrid(new Float32Array([0.8, 0.5, 0.2]), 0.5, true);
    expect([...out]).toEqual([0, 0, 1]);
  });

  it('invert=false is the same as omitting it (old behaviour unchanged)', () => {
    const intensity = new Float32Array([0.9, 0.4, 0.5, 0.1]);
    expect([...thresholdGrid(intensity, 0.5, false)]).toEqual([...thresholdGrid(intensity, 0.5)]);
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

describe('edge_margin mapping', () => {
  const white = (w: number, h: number) =>
    makeFrame(w, h, () => [255, 255, 255]);

  it('activeCols = cols - 2×margin (clamped >= 0)', () => {
    expect(activeCols(320, 10)).toBe(300);
    expect(activeCols(80, 40)).toBe(0);
    expect(activeCols(320, 0)).toBe(320);
  });

  it('margin=10, cols=320: valves 0-9 and 310-319 forced off; 10-309 active', () => {
    const row = frameToValveRow(white(64, 4), 320, 10, 0.5);
    for (let c = 0; c < 10; c++) expect(row[c]).toBe(0); // left edge off
    expect(row[10]).toBe(1);
    expect(row[309]).toBe(1);
    for (let c = 310; c < 320; c++) expect(row[c]).toBe(0); // right edge off
  });

  it('left-edge video column (u≈0) maps to valve 10, not 0', () => {
    // 300-px-wide frame, only the leftmost column white -> active cell 0.
    const img = makeFrame(300, 1, (x) => (x === 0 ? [255, 255, 255] : [0, 0, 0]));
    const row = frameToValveRow(img, 320, 10, 0.5);
    expect(row[10]).toBe(1);
    expect(row[11]).toBe(0);
    for (let c = 0; c < 10; c++) expect(row[c]).toBe(0);
  });

  it('right-edge video column (u≈1) maps near valve 309', () => {
    const img = makeFrame(300, 1, (x) => (x === 299 ? [255, 255, 255] : [0, 0, 0]));
    const row = frameToValveRow(img, 320, 10, 0.5);
    expect(row[309]).toBe(1);
    expect(row[308]).toBe(0);
    expect(row[310]).toBe(0); // edge stays off
  });

  it('center video column (u=0.5) maps to valve margin + active/2 = 160', () => {
    // 300-px frame (active=300), only the center column white.
    const img = makeFrame(300, 1, (x) => (x === 150 ? [255, 255, 255] : [0, 0, 0]));
    const row = frameToValveRow(img, 320, 10, 0.5);
    expect(row[160]).toBe(1); // 10 + 150
    expect(row[159]).toBe(0);
    expect(row[161]).toBe(0);
  });

  it('margin=0 maps u = v/valve_cols (left column -> valve 0)', () => {
    const img = makeFrame(8, 1, (x) => (x === 0 ? [255, 255, 255] : [0, 0, 0]));
    const row = frameToValveRow(img, 8, 0, 0.5);
    expect(row[0]).toBe(1); // u = 0/8 -> valve 0 (no margin)
    for (let c = 1; c < 8; c++) expect(row[c]).toBe(0);
  });

  it('margin=0 is unchanged behaviour (full coverage)', () => {
    const row = frameToValveRow(white(8, 1), 8, 0, 0.5);
    expect([...row]).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('invalid margin (2×margin >= cols) -> all off', () => {
    expect([...frameToValveRow(white(8, 1), 8, 4, 0.5)]).toEqual(
      new Array(8).fill(0),
    );
  });

  // Decisive COMPRESS-vs-CROP tests through the real pipeline (not via .bin,
  // which can't tell the two apart). length=8 -> valve_cols=320, margin=50,
  // active=220, active band = valves 50..269.
  const onIdx = (r: Uint8Array) => [...r].flatMap((v, i) => (v ? [i] : []));

  it('COMPRESS: left-edge video pixel (x=0) -> first active valve 50', () => {
    const img = makeFrame(320, 4, (x) => (x === 0 ? [255, 255, 255] : [0, 0, 0]));
    const r = frameToValveRow(img, 320, 50, 0.1);
    // COMPRESS -> [50]; CROP would drop the edge pixel -> [] (valve 50 samples mid-video)
    expect(onIdx(r)).toEqual([50]);
  });

  it('COMPRESS: right-edge video pixel (x=W-1) -> last active valve 269', () => {
    const img = makeFrame(320, 4, (x) => (x === 319 ? [255, 255, 255] : [0, 0, 0]));
    const r = frameToValveRow(img, 320, 50, 0.1);
    expect(onIdx(r)).toEqual([269]); // CROP -> [] (edge pixel lost)
  });

  it('COMPRESS: 320 stripes cover the full active band (no edges cropped)', () => {
    // White at even x: full 320-px alternating pattern, margin=50 -> active=220.
    const img = makeFrame(320, 4, (x) => (x % 2 === 0 ? [255, 255, 255] : [0, 0, 0]));
    const r = frameToValveRow(img, 320, 50, 0.5);
    const on = onIdx(r).filter((v) => v >= 50 && v < 270);
    expect(on[0]).toBe(50); // band starts at the first active valve
    expect(on[on.length - 1]).toBe(269); // ...and reaches the last active valve
    // Decisive: valve 269 reflects video col 319 (aliased). CROP -> col 269 (black) -> 0.
    expect(r[269]).toBe(1);
    expect(r[50]).toBe(1);
  });

  it('maskEdges zeros edge columns across rows', () => {
    const bool = new Uint8Array(10).fill(1); // 10 cols × 1 row, all on
    expect([...maskEdges(bool, 10, 1, 2)]).toEqual([
      0, 0, 1, 1, 1, 1, 1, 1, 0, 0,
    ]);
  });

  it('buildValveBin with margin: edge bytes off, active bytes set', async () => {
    const grid = await computeFullGrid({
      frameAt: async () => white(64, 4),
      cols: 320,
      rows: 1,
      row_ms: 16,
      threshold: 0.5,
      edge_margin: 10,
    });
    const bin = buildValveBin({ grid, cols: 320, rows: 1, row_ms: 16, B: 40, mode: 'grid' });
    const fs = parseStream(bin, 40);
    const data = fs[3].subarray(4); // CONFIG, RESET, START, data row0
    expect(data[0]).toBe(0x00); // valves 0-7: all off (edge)
    expect(data[1]).toBe(0x3f); // valves 8-15: 8,9 off (edge), 10-15 on
    expect(data[38]).toBe(0xfc); // valves 304-311: 304-309 on, 310,311 off
    expect(data[39]).toBe(0x00); // valves 312-319: off (edge)
  });
});

describe('invert threshold (dark shape on light background -> shape is water)', () => {
  // 4x2 frame: left half white (bright), right half black (dark) — like a
  // "heart" silhouette (dark) on a light background, simplified to two cols.
  it('invert=false (default): bright -> on, dark -> off (old behaviour)', () => {
    const row = frameToValveRow(halfWhite, 4, 0, 0.5);
    expect([...row]).toEqual([1, 1, 0, 0]); // left (bright) on, right (dark) off
  });

  it('invert=true: dark -> on, bright -> off (the shape becomes the water)', () => {
    const row = frameToValveRow(halfWhite, 4, 0, 0.5, true);
    expect([...row]).toEqual([0, 0, 1, 1]); // left (bright) off, right (dark) on
  });

  it('computeFullGrid threads invert through to every row', async () => {
    const gridOff = await computeFullGrid({
      frameAt: async () => halfWhite,
      cols: 4,
      rows: 2,
      row_ms: 80,
      threshold: 0.5,
    });
    expect([...gridOff]).toEqual([1, 1, 0, 0, 1, 1, 0, 0]);

    const gridOn = await computeFullGrid({
      frameAt: async () => halfWhite,
      cols: 4,
      rows: 2,
      row_ms: 80,
      threshold: 0.5,
      invert: true,
    });
    expect([...gridOn]).toEqual([0, 0, 1, 1, 0, 0, 1, 1]);
  });

  it('buildValveBin export reflects invert: shape region on, background off', async () => {
    const grid = await computeFullGrid({
      frameAt: async () => halfWhite,
      cols: 4,
      rows: 1,
      row_ms: 80,
      threshold: 0.5,
      invert: true,
    });
    const bin = buildValveBin({ grid, cols: 4, rows: 1, row_ms: 80, B: 1, mode: 'grid' });
    const fs = parseStream(bin, 1);
    // valves: 0,1 bright(off) -> bits 0,0 ; 2,3 dark(on) -> bits 1,1 => 0011 0000 = 0x30
    expect(fs[3][4]).toBe(0x30);
  });
});

describe('buildValveBin (integration, reading a precomputed grid)', () => {
  const frameAt = async () => halfWhite; // left valve on, right off, every row

  it('grid mode: CONFIG(cols), RESET, START, rows…, sentinel', async () => {
    const grid = await computeFullGrid({ frameAt, cols: 2, rows: 2, row_ms: 80, threshold: 0.5 });
    const bin = buildValveBin({ grid, cols: 2, rows: 2, row_ms: 80, B: 1, mode: 'grid' });
    const fs = parseStream(bin, 1);
    // CONFIG, RESET, START, row0, row1, sentinel
    expect(fs.length).toBe(6);
    expect(tsOf(fs[0])).toBe(TS_CONFIG >>> 0);
    expect(fs[0][4] | (fs[0][5] << 8)).toBe(2); // valve_count = cols
    expect(fs[3][4]).toBe(0x80); // row0: valve 0 on
    expect(fs[4][4]).toBe(0x80); // row1: valve 0 on
  });

  it('smooth mode merges the two on-rows into one open/close', async () => {
    const grid = await computeFullGrid({ frameAt, cols: 2, rows: 2, row_ms: 80, threshold: 0.5 });
    const bin = buildValveBin({ grid, cols: 2, rows: 2, row_ms: 80, B: 1, mode: 'smooth' });
    const fs = parseStream(bin, 1);
    // CONFIG, RESET, START, t0(open), t160(close), sentinel
    expect(fs.length).toBe(6);
    expect(tsOf(fs[0])).toBe(TS_CONFIG >>> 0);
  });

  it('no source -> all data frames all-off', async () => {
    const grid = await computeFullGrid({
      frameAt: async () => null,
      cols: 8,
      rows: 3,
      row_ms: 40,
      threshold: 0.5,
    });
    const bin = buildValveBin({ grid, cols: 8, rows: 3, row_ms: 40, B: 1, mode: 'grid' });
    for (const f of parseStream(bin, 1)) {
      if (f.length === 5) expect(f[4]).toBe(0x00); // data/control payload all 0
    }
  });

  it('paint overrides take effect in the export', async () => {
    const grid = await computeFullGrid({
      frameAt: async () => null, // nothing on from video
      cols: 2,
      rows: 1,
      row_ms: 80,
      threshold: 0.5,
      paint: { 1: true }, // force valve 1 (col 1) on at row 0
    });
    const bin = buildValveBin({ grid, cols: 2, rows: 1, row_ms: 80, B: 1, mode: 'grid' });
    const fs = parseStream(bin, 1);
    // RESET, CONFIG, START, row0, sentinel -> row0 = fs[3]
    expect(fs[3][4]).toBe(0x40); // valve 1 -> 0x40
  });
});

describe('scanline mapping (waterfall is an inkjet: each row reads a different line, not the whole frame)', () => {
  // A static "heart-ish" silhouette: 39px tall, narrow band of "ink" near the
  // top (the heart's notch), a wide band in the middle (the heart's widest
  // point), narrow again toward the bottom (the point at the base). White =
  // background, black = the shape. Single column (cols=1) keeps the
  // assertions about WHICH rows are on/off unambiguous.
  const HEART_H = 39;
  const heart = makeFrame(1, HEART_H, (_x, y) => {
    const inShape = y >= 13 && y <= 25; // the wide middle third
    return inShape ? [0, 0, 0] : [255, 255, 255];
  });

  it('rows 0-38 read 39 DIFFERENT scanlines — not the same averaged frame', async () => {
    const grid = await computeFullGrid({
      frameAt: async () => heart,
      cols: 1,
      rows: HEART_H,
      row_ms: 10,
      threshold: 0.5,
      invert: true, // dark shape = water
      visible_rows: HEART_H,
    });
    // Deep inside each band (avoids ±1 rounding right at a band edge).
    expect(grid[5]).toBe(0); // top notch: background, off
    expect(grid[19]).toBe(1); // widest point: the shape, on
    expect(grid[32]).toBe(0); // base point: background, off

    // The old bug (sampleFrameToGrid(img, cols, 1): average the WHOLE
    // height into one row) would make every row identical. Assert that
    // doesn't happen — a real composite needs more than one distinct value.
    const distinct = new Set(grid);
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('row (visible_rows + k) repeats row k — wraps back to the top of the frame', async () => {
    const rows = HEART_H * 2; // two full passes over the same static image
    const grid = await computeFullGrid({
      frameAt: async () => heart,
      cols: 1,
      rows,
      row_ms: 10,
      threshold: 0.5,
      invert: true,
      visible_rows: HEART_H,
    });
    for (const k of [5, 19, 32]) {
      expect(grid[HEART_H + k]).toBe(grid[k]);
    }
  });

  it('frameToValveRow: two different y_frac values on the same image can disagree', () => {
    const top = frameToValveRow(heart, 1, 0, 0.5, true, 5 / HEART_H);
    const middle = frameToValveRow(heart, 1, 0, 0.5, true, 19 / HEART_H);
    expect(top[0]).toBe(0);
    expect(middle[0]).toBe(1);
  });

  it('visible_rows omitted defaults to `rows` (scan once, no wrap) without throwing', async () => {
    const grid = await computeFullGrid({
      frameAt: async () => heart,
      cols: 1,
      rows: HEART_H,
      row_ms: 10,
      threshold: 0.5,
      invert: true,
    });
    expect(new Set(grid).size).toBeGreaterThan(1);
  });
});

describe('flip_h / flip_v (mirror left<->right / scan bottom-to-top)', () => {
  // 4 cols x 8 rows. A single dark pixel at (x=0, y=2), everything else
  // white. invert=true (dark = water). Powers of 2 keep every fraction
  // (1/8, 2/8, 3/8, ...) exactly representable, so the expected row index
  // for a given scanline is unambiguous (no floating-point edge cases).
  const W = 4;
  const H = 8;
  const dot = makeFrame(W, H, (x, y) => (x === 0 && y === 2 ? [0, 0, 0] : [255, 255, 255]));
  const params = {
    frameAt: async () => dot,
    cols: W,
    rows: H,
    row_ms: 10,
    threshold: 0.5,
    invert: true,
    visible_rows: H,
  };
  // Without any flip: row 2 reads y=2 (the dot, at col 0) -> [1,0,0,0].
  // flip_v alone moves the row that reads y=2 from row 2 to row 6.
  // flip_h alone mirrors columns within whichever row reads the dot.
  const rowAt = (grid: Uint8Array, r: number) => [...grid.slice(r * W, r * W + W)];

  it('off (default): old behaviour — row 2 = [1,0,0,0], row 6 = all off', async () => {
    const grid = await computeFullGrid(params);
    expect(rowAt(grid, 2)).toEqual([1, 0, 0, 0]);
    expect(rowAt(grid, 6)).toEqual([0, 0, 0, 0]);
  });

  it('flip_h: mirrors columns — row 2 = [0,0,0,1] (left<->right), row index unchanged', async () => {
    const grid = await computeFullGrid({ ...params, flip_h: true });
    expect(rowAt(grid, 2)).toEqual([0, 0, 0, 1]);
    expect(rowAt(grid, 6)).toEqual([0, 0, 0, 0]);
  });

  it('flip_v: mirrors the scan direction — the dot now shows up at row 6, not row 2', async () => {
    const grid = await computeFullGrid({ ...params, flip_v: true });
    expect(rowAt(grid, 2)).toEqual([0, 0, 0, 0]);
    expect(rowAt(grid, 6)).toEqual([1, 0, 0, 0]);
  });

  it('both flip_h + flip_v together = 180° rotation (row AND column mirrored)', async () => {
    const grid = await computeFullGrid({ ...params, flip_h: true, flip_v: true });
    expect(rowAt(grid, 2)).toEqual([0, 0, 0, 0]);
    expect(rowAt(grid, 6)).toEqual([0, 0, 0, 1]);
  });

  it('frameToValveRow: flip_h reorders bits[active-1-k] directly', () => {
    const plain = frameToValveRow(dot, W, 0, 0.5, true, 2 / H);
    const flipped = frameToValveRow(dot, W, 0, 0.5, true, 2 / H, true);
    expect([...plain]).toEqual([1, 0, 0, 0]);
    expect([...flipped]).toEqual([0, 0, 0, 1]);
  });
});

describe('computeFullGrid (whole-grid precompute, shared by Play/preview/export)', () => {
  it('matches per-row frameToValveRow for every row (no drift)', async () => {
    // 2 cols × 3 rows; left col white (on), right col black (off), every row.
    const frameAt = async () => halfWhite;
    const grid = await computeFullGrid({ frameAt, cols: 2, rows: 3, row_ms: 80, threshold: 0.5 });
    for (let r = 0; r < 3; r++) {
      const expected = frameToValveRow(halfWhite, 2, 0, 0.5);
      expect([...grid.slice(r * 2, r * 2 + 2)]).toEqual([...expected]);
    }
  });

  it('grid[0] and grid[N-1] reflect the frame at their own row time', async () => {
    // The source "video" flips from black to white at t=500ms.
    const black = makeFrame(2, 2, () => [0, 0, 0]);
    const white = makeFrame(2, 2, () => [255, 255, 255]);
    const frameAt = async (t: number) => (t < 500 ? black : white);
    const cols = 1;
    const rows = 40; // row_ms=20 -> t=0..780ms, spans the t=500 flip
    const row_ms = 20;
    const grid = await computeFullGrid({ frameAt, cols, rows, row_ms, threshold: 0.5 });
    expect(grid[0]).toBe(0); // row 0 @ t=0 -> black -> off
    expect(grid[rows - 1]).toBe(1); // last row @ t=780 -> white -> on
  });

  it('edge valves stay off regardless of video content', async () => {
    const allOn = makeFrame(4, 2, () => [255, 255, 255]);
    const grid = await computeFullGrid({
      frameAt: async () => allOn,
      cols: 4,
      rows: 1,
      row_ms: 80,
      threshold: 0.5,
      edge_margin: 1,
    });
    expect([...grid]).toEqual([0, 1, 1, 0]); // valve 0 & 3 forced off
  });

  it('combines video + paint for the SAME row, like sampleValveRow used to', async () => {
    const allOff = makeFrame(4, 2, () => [0, 0, 0]);
    const rowIndex = 2;
    const grid = await computeFullGrid({
      frameAt: async () => allOff,
      cols: 4,
      rows: 3,
      row_ms: 80,
      threshold: 0.5,
      paint: { [rowIndex * 4 + 1]: true }, // force valve 1 on at this row
    });
    expect([...grid.slice(rowIndex * 4, rowIndex * 4 + 4)]).toEqual([0, 1, 0, 0]);
    expect([...grid.slice(0, 4)]).toEqual([0, 0, 0, 0]); // other rows unaffected
  });

  it('no source -> all off', async () => {
    const grid = await computeFullGrid({
      frameAt: async () => null,
      cols: 4,
      rows: 2,
      row_ms: 80,
      threshold: 0.5,
    });
    expect([...grid]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('seek-reuse: reuses one frameAt() call across the rows in the same assumed video frame', async () => {
    const calls: number[] = [];
    const frameAt = async (t: number) => {
      calls.push(t);
      return halfWhite;
    };
    // row_ms=16, video_fps=30 -> ~33.3ms/frame -> ~3 rows share one seek.
    await computeFullGrid({
      frameAt,
      cols: 2,
      rows: 12,
      row_ms: 16,
      threshold: 0.5,
      video_fps: 30,
    });
    expect(calls.length).toBeLessThan(12);
    expect(calls.length).toBeGreaterThan(0);
  });

  it('reports progress reaching 1 at the end', async () => {
    const seen: number[] = [];
    await computeFullGrid({
      frameAt: async () => halfWhite,
      cols: 2,
      rows: 20,
      row_ms: 16,
      threshold: 0.5,
      onProgress: (f) => seen.push(f),
    });
    expect(seen[seen.length - 1]).toBe(1);
    expect(seen.every((f, i) => i === 0 || f >= seen[i - 1])).toBe(true); // monotonic
  });

  it('isCancelled stops the loop early', async () => {
    const calls: number[] = [];
    const frameAt = async (t: number) => {
      calls.push(t);
      return halfWhite;
    };
    await computeFullGrid({
      frameAt,
      cols: 2,
      rows: 1000,
      row_ms: 1,
      threshold: 0.5,
      isCancelled: () => calls.length >= 3,
    });
    expect(calls.length).toBeLessThan(10);
  });

  it('replay: reading the same precomputed grid twice gives identical results', async () => {
    const grid = await computeFullGrid({
      frameAt: async () => halfWhite,
      cols: 2,
      rows: 5,
      row_ms: 80,
      threshold: 0.5,
    });
    const readAt = (rowIndex: number) => [...grid.slice(rowIndex * 2, rowIndex * 2 + 2)];
    const firstPass = [0, 1, 2, 3, 4].map(readAt);
    const secondPass = [0, 1, 2, 3, 4].map(readAt);
    expect(secondPass).toEqual(firstPass);
  });
});
