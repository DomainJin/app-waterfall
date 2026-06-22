import { describe, expect, it } from 'vitest';
import {
  applyBrightnessGamma,
  buildLedScriptFile,
  computeLedScript,
  flattenRgb,
  PALETTES,
  readLedScriptRow,
} from '../src/core/layers/led';
import {
  buildConfig,
  buildDataFrame,
  buildSentinel,
  ChannelOrder,
  FrameType,
  HEADER_BYTES,
  Origin,
  Wiring,
  CONFIG_PAYLOAD_BYTES,
} from '../src/codec/ic9803';

const RED = { r: 255, g: 0, b: 0 };

// 8 valve cols, 2 LEDs -> ratio 4 (LED i covers valves [4i, 4i+3]).
function grid(rows: number[][]): { valveGrid: Uint8Array; gridRows: number; gridCols: number } {
  const gridCols = rows[0].length;
  const valveGrid = new Uint8Array(rows.flat());
  return { valveGrid, gridRows: rows.length, gridCols };
}

const baseOpts = { baseColor: RED, fadeSpeed: 6, palette: PALETTES.rainbow, brightness: 255, gamma: 1 };

describe('applyBrightnessGamma', () => {
  it('brightness=255, gamma=1 is the identity', () => {
    expect(applyBrightnessGamma({ r: 200, g: 100, b: 50 }, 255, 1)).toEqual({ r: 200, g: 100, b: 50 });
  });

  it('brightness=0 zeroes everything', () => {
    expect(applyBrightnessGamma({ r: 200, g: 100, b: 50 }, 0, 1)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('brightness halves linearly', () => {
    const out = applyBrightnessGamma({ r: 200, g: 0, b: 0 }, 127.5, 1);
    expect(out.r).toBeCloseTo(100, 0);
  });
});

describe('flattenRgb', () => {
  it('flattens row-major R,G,B per cell', () => {
    const flat = flattenRgb([{ r: 1, g: 2, b: 3 }, { r: 4, g: 5, b: 6 }]);
    expect([...flat]).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('computeLedScript — empty/edge inputs', () => {
  it('gridRows <= 0 or ledCols <= 0 -> empty script', () => {
    const { valveGrid } = grid([[0, 0, 0, 0, 0, 0, 0, 0]]);
    expect(computeLedScript(valveGrid, 0, 8, 2, { mode: 'normal', ...baseOpts })).toHaveLength(0);
    expect(computeLedScript(valveGrid, 1, 8, 0, { mode: 'normal', ...baseOpts })).toHaveLength(0);
  });

  it('gridCols <= 0 (no valve columns) -> correctly-shaped, all-black script', () => {
    const { valveGrid } = grid([[0, 0, 0, 0, 0, 0, 0, 0]]);
    const out = computeLedScript(valveGrid, 1, 0, 2, { mode: 'normal', ...baseOpts });
    expect(out).toHaveLength(1 * 2 * 3);
    expect([...out]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('output length is rows * ledCols * 3', () => {
    const { valveGrid, gridRows, gridCols } = grid([
      [0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ]);
    const out = computeLedScript(valveGrid, gridRows, gridCols, 2, { mode: 'normal', ...baseOpts });
    expect(out).toHaveLength(2 * 2 * 3);
  });
});

describe('computeLedScript — NORMAL', () => {
  it('always the base color, regardless of valve state', () => {
    const { valveGrid, gridRows, gridCols } = grid([
      [0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ]);
    const out = computeLedScript(valveGrid, gridRows, gridCols, 2, { mode: 'normal', ...baseOpts });
    for (let r = 0; r < gridRows; r++) {
      expect(readLedScriptRow(out, r, 2)).toEqual([RED, RED]);
    }
  });
});

describe('computeLedScript — FOCUS (LED_MODE_SPEC.md §3)', () => {
  it('LED off (black) when ALL of its cluster valves are OFF', () => {
    const { valveGrid, gridRows, gridCols } = grid([[0, 0, 0, 0, 0, 0, 0, 0]]);
    const out = computeLedScript(valveGrid, gridRows, gridCols, 2, { mode: 'focus', ...baseOpts });
    expect(readLedScriptRow(out, 0, 2)).toEqual([{ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }]);
  });

  it('LED on (base color) when AT LEAST ONE of its cluster valves is ON', () => {
    const { valveGrid, gridRows, gridCols } = grid([[0, 0, 1, 0, 0, 0, 0, 0]]); // valve 2 -> LED 0
    const out = computeLedScript(valveGrid, gridRows, gridCols, 2, { mode: 'focus', ...baseOpts });
    expect(readLedScriptRow(out, 0, 2)).toEqual([RED, { r: 0, g: 0, b: 0 }]);
  });

  it('each LED reacts only to its own cluster, not the whole row', () => {
    const { valveGrid, gridRows, gridCols } = grid([[0, 0, 0, 0, 0, 0, 0, 1]]); // valve 7 -> LED 1
    const out = computeLedScript(valveGrid, gridRows, gridCols, 2, { mode: 'focus', ...baseOpts });
    expect(readLedScriptRow(out, 0, 2)).toEqual([{ r: 0, g: 0, b: 0 }, RED]);
  });

  it('tracks the valve pattern row by row (reacts to the texture, not stuck at one value)', () => {
    const { valveGrid, gridRows, gridCols } = grid([
      [1, 1, 1, 1, 0, 0, 0, 0], // LED0 on, LED1 off
      [0, 0, 0, 0, 1, 1, 1, 1], // LED0 off, LED1 on
    ]);
    const out = computeLedScript(valveGrid, gridRows, gridCols, 2, { mode: 'focus', ...baseOpts });
    expect(readLedScriptRow(out, 0, 2)).toEqual([RED, { r: 0, g: 0, b: 0 }]);
    expect(readLedScriptRow(out, 1, 2)).toEqual([{ r: 0, g: 0, b: 0 }, RED]);
  });
});

describe('computeLedScript — FADE', () => {
  it('eases brightness up on an OFF->ON edge instead of jumping to full base color', () => {
    const rows = Array.from({ length: 10 }, () => [1, 1, 1, 1, 1, 1, 1, 1]);
    const { valveGrid, gridRows, gridCols } = grid(rows);
    const out = computeLedScript(valveGrid, gridRows, gridCols, 1, {
      mode: 'fade',
      ...baseOpts,
      fadeSpeed: 5,
    });
    const first = readLedScriptRow(out, 0, 1)[0];
    const last = readLedScriptRow(out, gridRows - 1, 1)[0];
    expect(first.r).toBeGreaterThan(0);
    expect(first.r).toBeLessThan(255); // first row hasn't fully reached the target yet
    expect(last.r).toBeGreaterThan(first.r); // keeps climbing toward 255
  });

  it('eases brightness down on an ON->OFF edge instead of snapping to black', () => {
    const rows = [
      ...Array.from({ length: 10 }, () => [1, 1, 1, 1, 1, 1, 1, 1]),
      ...Array.from({ length: 5 }, () => [0, 0, 0, 0, 0, 0, 0, 0]),
    ];
    const { valveGrid, gridRows, gridCols } = grid(rows);
    const out = computeLedScript(valveGrid, gridRows, gridCols, 1, {
      mode: 'fade',
      ...baseOpts,
      fadeSpeed: 5,
    });
    const justAfterOff = readLedScriptRow(out, 10, 1)[0];
    expect(justAfterOff.r).toBeGreaterThan(0); // dimming, not instantly black
    const wellAfterOff = readLedScriptRow(out, 14, 1)[0];
    expect(wellAfterOff.r).toBeLessThan(justAfterOff.r);
  });
});

describe('computeLedScript — MIX_COLOR (LED_MODE_SPEC.md §3.4)', () => {
  it('each block of consecutive ON rows gets its own palette color, off rows are black', () => {
    const rows = [
      [0, 0, 0, 0], // off
      [0, 0, 0, 0],
      [1, 1, 1, 1], // block A starts
      [1, 1, 1, 1],
      [0, 0, 0, 0], // off
      [1, 1, 1, 1], // block B starts
    ];
    const { valveGrid, gridRows, gridCols } = grid(rows);
    const out = computeLedScript(valveGrid, gridRows, gridCols, 1, {
      mode: 'mix',
      ...baseOpts,
      palette: PALETTES.rainbow,
    });
    const r = (row: number) => readLedScriptRow(out, row, 1)[0];

    expect(r(0)).toEqual({ r: 0, g: 0, b: 0 });
    expect(r(1)).toEqual({ r: 0, g: 0, b: 0 });
    expect(r(2)).toEqual(r(3)); // same block -> same color
    expect(r(2)).not.toEqual({ r: 0, g: 0, b: 0 });
    expect(r(4)).toEqual({ r: 0, g: 0, b: 0 });
    expect(r(5)).not.toEqual({ r: 0, g: 0, b: 0 });
    expect(r(5)).not.toEqual(r(2)); // new block -> a different color than the last
  });

  it('cycles through the whole palette without repeating consecutively', () => {
    // 7 alternating on/off blocks (4 ON blocks) with a 4-color palette ->
    // exercises the wrap-around (4th ON block reuses palette[0]).
    const rows: number[][] = [];
    for (let block = 0; block < 7; block++) {
      const on = block % 2 === 0 ? 1 : 0;
      rows.push([on, on], [on, on]);
    }
    const { valveGrid, gridRows, gridCols } = grid(rows);
    const palette = PALETTES.rainbow.slice(0, 4);
    const out = computeLedScript(valveGrid, gridRows, gridCols, 1, {
      mode: 'mix',
      ...baseOpts,
      palette,
    });
    const onBlockStarts = [0, 4, 8, 12]; // rows where each ON block begins
    const colors = onBlockStarts.map((row) => readLedScriptRow(out, row, 1)[0]);
    expect(colors[0]).toEqual(palette[0]);
    expect(colors[1]).toEqual(palette[1]);
    expect(colors[2]).toEqual(palette[2]);
    expect(colors[3]).toEqual(palette[3]); // wrapped back to the start of the 4-color palette
  });
});

describe('readLedScriptRow', () => {
  it('reads the right slice for a given row', () => {
    const script = new Uint8Array([1, 2, 3, 4, 5, 6, /* row 1 */ 7, 8, 9, 10, 11, 12]);
    expect(readLedScriptRow(script, 0, 2)).toEqual([{ r: 1, g: 2, b: 3 }, { r: 4, g: 5, b: 6 }]);
    expect(readLedScriptRow(script, 1, 2)).toEqual([{ r: 7, g: 8, b: 9 }, { r: 10, g: 11, b: 12 }]);
  });
});

describe('brightness/gamma post-processing in computeLedScript', () => {
  it('brightness=0 forces every cell to black, even when ON', () => {
    const { valveGrid, gridRows, gridCols } = grid([[1, 1, 1, 1]]);
    const out = computeLedScript(valveGrid, gridRows, gridCols, 1, {
      mode: 'focus',
      ...baseOpts,
      brightness: 0,
    });
    expect(readLedScriptRow(out, 0, 1)).toEqual([{ r: 0, g: 0, b: 0 }]);
  });
});

describe('buildLedScriptFile', () => {
  // 2 rows × 2 cols script: row0 = [RED, GREEN], row1 = [BLUE, WHITE].
  const script = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
  const baseParams = {
    script,
    rows: 2,
    cols: 2,
    row_ms: 16,
    wiring: Wiring.LINEAR,
    origin: Origin.TOP_LEFT,
    channelOrder: ChannelOrder.RGB,
    payloadMode: 'rgb888' as const,
  };

  it('is byte-identical to manually concatenating CONFIG + per-row DATA + SENTINEL', () => {
    const file = buildLedScriptFile(baseParams);

    const expectedConfig = buildConfig(2, 1, Wiring.LINEAR, Origin.TOP_LEFT, ChannelOrder.RGB);
    const expectedRow0 = buildDataFrame(readLedScriptRow(script, 0, 2), {
      ts_ms: 0,
      timestamped: true,
      packed: false,
      latch: true,
      order: ChannelOrder.RGB,
    });
    const expectedRow1 = buildDataFrame(readLedScriptRow(script, 1, 2), {
      ts_ms: 16,
      timestamped: true,
      packed: false,
      latch: true,
      order: ChannelOrder.RGB,
    });
    const expectedSentinel = buildSentinel();
    const expected = new Uint8Array([...expectedConfig, ...expectedRow0, ...expectedRow1, ...expectedSentinel]);

    expect([...file]).toEqual([...expected]);
  });

  it('frame layout: CONFIG, then one DATA frame per row, then SENTINEL', () => {
    const file = buildLedScriptFile(baseParams);
    const dataFrameBytes = HEADER_BYTES + baseParams.cols * 3; // RGB888

    expect(file.length).toBe((HEADER_BYTES + CONFIG_PAYLOAD_BYTES) + 2 * dataFrameBytes + HEADER_BYTES);
    expect(file[4]).toBe(FrameType.CONFIG); // header byte 4 = type
    const row0Offset = HEADER_BYTES + CONFIG_PAYLOAD_BYTES;
    expect(file[row0Offset + 4]).toBe(FrameType.DATA);
    const row1Offset = row0Offset + dataFrameBytes;
    expect(file[row1Offset + 4]).toBe(FrameType.DATA);
    const sentinelOffset = row1Offset + dataFrameBytes;
    expect(file[sentinelOffset + 4]).toBe(FrameType.SENTINEL);
    expect(file.length).toBe(sentinelOffset + HEADER_BYTES);
  });

  it('ts_ms increases by row_ms per row (little-endian u32 at header offset 6)', () => {
    const file = buildLedScriptFile(baseParams);
    const dataFrameBytes = HEADER_BYTES + baseParams.cols * 3;
    const row0Offset = HEADER_BYTES + CONFIG_PAYLOAD_BYTES;
    const row1Offset = row0Offset + dataFrameBytes;
    const view = new DataView(file.buffer);
    expect(view.getUint32(row0Offset + 6, true)).toBe(0);
    expect(view.getUint32(row1Offset + 6, true)).toBe(16);
  });

  it('0 rows -> just CONFIG + SENTINEL, no DATA frames', () => {
    const file = buildLedScriptFile({ ...baseParams, rows: 0 });
    expect(file.length).toBe(HEADER_BYTES + CONFIG_PAYLOAD_BYTES + HEADER_BYTES);
    expect(file[4]).toBe(FrameType.CONFIG);
    expect(file[HEADER_BYTES + CONFIG_PAYLOAD_BYTES + 4]).toBe(FrameType.SENTINEL);
  });

  it('packed16 payload mode halves the per-pixel payload size (2 bytes vs 3)', () => {
    const rgb888File = buildLedScriptFile(baseParams);
    const packed16File = buildLedScriptFile({ ...baseParams, payloadMode: 'packed16' });
    const perRowSavings = baseParams.cols * (3 - 2);
    expect(rgb888File.length - packed16File.length).toBe(perRowSavings * baseParams.rows);
  });

  it('dynamic input: scales correctly with a larger row/col count', () => {
    const rows = 5;
    const cols = 4;
    const bigScript = new Uint8Array(rows * cols * 3).fill(7);
    const file = buildLedScriptFile({ ...baseParams, script: bigScript, rows, cols });
    const dataFrameBytes = HEADER_BYTES + cols * 3;
    expect(file.length).toBe(HEADER_BYTES + CONFIG_PAYLOAD_BYTES + rows * dataFrameBytes + HEADER_BYTES);
  });
});
