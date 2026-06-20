import { describe, expect, it } from 'vitest';
import {
  buildAnimationGrid,
  buildAnimationSmooth,
  packConfigFrame,
  packFrame,
  TS_CONFIG,
  TS_RESET,
  TS_START,
  valveBits,
  type ValveEvent,
} from '../src/codec/valveBin';

// B for a given valve count = ceil(cols / 8). (Mirrors physical geometry but
// the codec is independent of it.)
const bytesFor = (cols: number) => Math.ceil(cols / 8);

// Read the LE u32 timestamp from the start of a frame.
const tsOf = (f: Uint8Array) =>
  (f[0] | (f[1] << 8) | (f[2] << 16) | (f[3] << 24)) >>> 0;

// CONFIG payload: u16 LE valve_count at offset 4.
const valveCountOf = (f: Uint8Array) => f[4] | (f[5] << 8);

/**
 * Split a stream into frames, dispatching on the leading ts exactly as the
 * firmware must: TS_CONFIG => 6 bytes, otherwise a data/control frame = 4 + B.
 */
function parseStream(stream: Uint8Array, B: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  let i = 0;
  while (i < stream.length) {
    const ts = tsOf(stream.subarray(i));
    const len = ts === (TS_CONFIG >>> 0) ? 6 : 4 + B;
    out.push(stream.slice(i, i + len));
    i += len;
  }
  return out;
}

describe('packFrame', () => {
  it('data frame size = 4 + B', () => {
    expect(packFrame(0, new Uint8Array(10)).length).toBe(14);
    expect(packFrame(0, new Uint8Array(40)).length).toBe(44);
    expect(packFrame(0, new Uint8Array(7)).length).toBe(11);
  });

  it('ts_ms is Little-Endian (160 -> A0 00 00 00)', () => {
    expect([...packFrame(160, new Uint8Array(10)).slice(0, 4)]).toEqual([
      0xa0, 0x00, 0x00, 0x00,
    ]);
  });

  it('reserved timestamps encode as in the spec', () => {
    expect([...packFrame(TS_RESET, new Uint8Array(10)).slice(0, 4)]).toEqual([
      0xff, 0xff, 0xff, 0xff,
    ]);
    expect([...packFrame(TS_START, new Uint8Array(10)).slice(0, 4)]).toEqual([
      0xfe, 0xff, 0xff, 0xff,
    ]);
  });
});

describe('packConfigFrame', () => {
  it('is exactly 6 bytes: [FD FF FF FF][valve_count u16 LE], no padding', () => {
    const f = packConfigFrame(320);
    expect(f.length).toBe(6);
    expect([...f.slice(0, 4)]).toEqual([0xfd, 0xff, 0xff, 0xff]);
  });

  it('valve_count is Little-Endian: 80->50 00, 320->40 01, 400->90 01', () => {
    expect([...packConfigFrame(80).slice(4)]).toEqual([0x50, 0x00]);
    expect([...packConfigFrame(320).slice(4)]).toEqual([0x40, 0x01]);
    expect([...packConfigFrame(400).slice(4)]).toEqual([0x90, 0x01]);
  });
});

describe('valveBits — MSB-first packing', () => {
  it('valve 0 -> byte[0]=0x80, valve 7 -> byte[0]=0x01', () => {
    expect(valveBits([0], 10)[0]).toBe(0x80);
    expect(valveBits([7], 10)[0]).toBe(0x01);
  });

  it('valve 8 -> byte[1]=0x80, valve 79 -> byte[9]=0x01', () => {
    expect(valveBits([8], 10)[1]).toBe(0x80);
    expect(valveBits([79], 10)[9]).toBe(0x01);
  });

  it('spec example: valves 1,5,9 (0-idx 0,4,8) -> 0x88,0x80', () => {
    const b = valveBits([0, 4, 8], 10);
    expect(b[0]).toBe(0x88);
    expect(b[1]).toBe(0x80);
    for (let i = 2; i < 10; i++) expect(b[i]).toBe(0x00);
  });
});

describe('valveBits — dynamic B', () => {
  it('2 m (B=10), 8 m (B=40) buffer lengths', () => {
    expect(valveBits([], bytesFor(80)).length).toBe(10);
    expect(valveBits([], bytesFor(320)).length).toBe(40);
  });

  it('non-multiple-of-8 width (50 valves -> B=7); trailing bits stay 0', () => {
    const B = bytesFor(50); // 7
    expect(B).toBe(7);
    const b = valveBits([49], B); // valve 49 -> byte 6, bit 6 -> 0x40
    expect(b[6]).toBe(0x40);
    expect(b[6] & 0b00111111).toBe(0); // valves 50..55 unused -> 0
    expect(valveBits([56, 99], B)[6]).toBe(0x00); // out-of-range ignored
  });
});

describe('buildAnimationGrid — CONFIG-first stream order', () => {
  const B = 10;
  const fs = parseStream(buildAnimationGrid([[0], [1]], 80, B, 80), B);

  it('order is CONFIG, RESET, START, data…, sentinel', () => {
    expect(tsOf(fs[0])).toBe(TS_CONFIG >>> 0);
    expect(tsOf(fs[1])).toBe(TS_RESET >>> 0);
    expect(tsOf(fs[2])).toBe(TS_START >>> 0);
    expect(tsOf(fs[3])).toBe(0); // first data
    expect(tsOf(fs[4])).toBe(80);
    expect(tsOf(fs[fs.length - 1])).toBe(2 * 80); // sentinel
  });

  it('frame count = CONFIG + RESET + START + rows + sentinel', () => {
    expect(fs.length).toBe(3 + 2 + 1); // 3 control + 2 rows + sentinel
  });

  it('CONFIG is the first frame (offset 0), 6 bytes, valve_count LE', () => {
    expect(fs[0].length).toBe(6);
    expect(valveCountOf(fs[0])).toBe(80);
  });

  it('RESET and START carry all-zero bits; data frames carry the bits', () => {
    expect([...fs[1].slice(4)]).toEqual(new Array(B).fill(0)); // RESET
    expect([...fs[2].slice(4)]).toEqual(new Array(B).fill(0)); // START
    expect(fs[3][4]).toBe(0x80); // valve 0
    expect(fs[4][4]).toBe(0x40); // valve 1
  });

  it('sentinel is all-off at rows*row_ms', () => {
    expect([...fs[fs.length - 1].slice(4)]).toEqual(new Array(B).fill(0));
  });

  it('is byte-exact for a minimal stream (B=1, valve_count=8)', () => {
    const expected = [
      0xfd, 0xff, 0xff, 0xff, 0x08, 0x00, // CONFIG first, valve_count=8 (08 00)
      0xff, 0xff, 0xff, 0xff, 0x00, // RESET, all-off
      0xfe, 0xff, 0xff, 0xff, 0x00, // START, all-off
      0x00, 0x00, 0x00, 0x00, 0x80, // ts=0, valve 0 on
      0x50, 0x00, 0x00, 0x00, 0x00, // sentinel ts=80 (0x50), all-off
    ];
    expect([...buildAnimationGrid([[0]], 80, 1, 8)]).toEqual(expected);
  });

  it('diagonal (80 valves, B=10) length includes the 6-byte CONFIG', () => {
    const rows = Array.from({ length: 80 }, (_, i) => [i]);
    const s = buildAnimationGrid(rows, 80, 10, 80);
    // CONFIG(6) + RESET(14) + START(14) + 80×14 + sentinel(14) = 1168
    expect(s.length).toBe(6 + 14 + 14 + 80 * 14 + 14);
  });
});

describe('buildAnimationSmooth — CONFIG-first stream order', () => {
  const B = 10;

  it('order CONFIG(320), RESET, START, state frames, sentinel; cumulative state', () => {
    const events: ValveEvent[] = [
      { t_ms: 0, valve: 0, on: true },
      { t_ms: 80, valve: 0, on: false },
      { t_ms: 80, valve: 1, on: true },
      { t_ms: 160, valve: 1, on: false },
    ];
    const fs = parseStream(buildAnimationSmooth(events, 80, B, 320), B);
    expect(tsOf(fs[0])).toBe(TS_CONFIG >>> 0);
    expect(valveCountOf(fs[0])).toBe(320);
    expect(tsOf(fs[1])).toBe(TS_RESET >>> 0);
    expect(tsOf(fs[2])).toBe(TS_START >>> 0);
    expect(fs[3][4]).toBe(0x80); // t=0: valve 0 on
    expect(fs[4][4]).toBe(0x40); // t=80: valve 0 off, valve 1 on
    expect(fs[5][4]).toBe(0x00); // t=160: valve 1 off
    expect(tsOf(fs[6])).toBe(160 + 80); // sentinel
  });

  it('opens are applied before closes at the same ts; sorts ascending', () => {
    const events: ValveEvent[] = [
      { t_ms: 100, valve: 2, on: false },
      { t_ms: 0, valve: 2, on: true },
    ];
    const fs = parseStream(buildAnimationSmooth(events, 50, B, 80), B);
    expect(tsOf(fs[3])).toBe(0); // sorted ascending despite input order
    expect(fs[3][4]).toBe(0x20); // valve 2 -> bit 5 -> 0x20
    expect(tsOf(fs[4])).toBe(100);
    expect(fs[4][4]).toBe(0x00);
  });

  it('empty events -> CONFIG, RESET, START, sentinel only', () => {
    const fs = parseStream(buildAnimationSmooth([], 80, B, 80), B);
    expect(fs.length).toBe(4);
    expect(tsOf(fs[0])).toBe(TS_CONFIG >>> 0);
    expect(tsOf(fs[3])).toBe(80); // sentinel at lastTs(0) + row_ms
  });
});
