import { describe, expect, it } from 'vitest';
import {
  buildBrightness,
  buildConfig,
  buildDataFrame,
  buildHeader,
  buildHeartbeat,
  buildReset,
  buildSentinel,
  buildStart,
  ChannelOrder,
  FLAG_CHANNEL_SWAP,
  FLAG_LATCH_NOW,
  FLAG_PACKED16,
  FLAG_TIMESTAMPED,
  FrameType,
  HEADER_BYTES,
  Origin,
  packPixels16,
  packPixelsRGB888,
  Wiring,
  type RGB,
} from '../src/codec/ic9803';

// Mirrors the firmware's own decode (03_LED_WIRE_FORMAT.md §8) — read the
// header fields back out the same way the ESP32 would.
function readHeader(f: Uint8Array) {
  return {
    magic: [f[0], f[1]],
    version: f[2],
    flags: f[3],
    type: f[4],
    reserved: f[5],
    ts_ms: (f[6] | (f[7] << 8) | (f[8] << 16) | (f[9] << 24)) >>> 0,
    count: f[10] | (f[11] << 8),
  };
}

describe('buildHeader — 12-byte fixed header', () => {
  it('is exactly 12 bytes', () => {
    expect(buildHeader(FrameType.DATA, 0, 0, 0).length).toBe(HEADER_BYTES);
  });

  it('magic is "WL" (0x57 0x4C), version 0x01', () => {
    const h = readHeader(buildHeader(FrameType.RESET, 0, 0, 0));
    expect(h.magic).toEqual([0x57, 0x4c]);
    expect(h.version).toBe(0x01);
  });

  it('ts_ms and count are Little-Endian', () => {
    const f = buildHeader(FrameType.DATA, 0, 0x000001a0, 0x0003);
    expect(f[6]).toBe(0xa0); // low byte first
    expect(f[7]).toBe(0x01);
    expect(f[8]).toBe(0x00);
    expect(f[9]).toBe(0x00);
    expect(f[10]).toBe(0x03);
    expect(f[11]).toBe(0x00);
    const h = readHeader(f);
    expect(h.ts_ms).toBe(0x1a0);
    expect(h.count).toBe(3);
  });

  it('reserved byte is always 0x00', () => {
    expect(readHeader(buildHeader(FrameType.DATA, 0xff, 123, 456)).reserved).toBe(0x00);
  });

  it('flags and type land in the right byte offsets', () => {
    const h = readHeader(buildHeader(FrameType.CONFIG, 0x09, 0, 0));
    expect(h.flags).toBe(0x09);
    expect(h.type).toBe(FrameType.CONFIG);
  });
});

describe('packPixelsRGB888 — literal R G B bytes, bpp=3', () => {
  it('3 bytes per LED, in R,G,B order', () => {
    const cells: RGB[] = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
    ];
    const out = packPixelsRGB888(cells);
    expect(out.length).toBe(9);
    expect([...out]).toEqual([255, 0, 0, 0, 255, 0, 0, 0, 255]);
  });

  it('does NOT permute channels — order is the firmware\'s job', () => {
    const out = packPixelsRGB888([{ r: 10, g: 20, b: 30 }]);
    expect([...out]).toEqual([10, 20, 30]);
  });
});

describe('packPixels16 — IC9803 16-bit word, LE, bpp=2', () => {
  it('2 bytes per LED', () => {
    expect(packPixels16([{ r: 0, g: 0, b: 0 }]).length).toBe(2);
  });

  it('bit15 is always 1 (spec example: red full -> 0xFC00, LE bytes 00 FC)', () => {
    const out = packPixels16([{ r: 255, g: 0, b: 0 }], ChannelOrder.RGB);
    expect([...out]).toEqual([0x00, 0xfc]);
  });

  it('spec example: blue full -> 0x801F, LE bytes 1F 80', () => {
    const out = packPixels16([{ r: 0, g: 0, b: 255 }], ChannelOrder.RGB);
    expect([...out]).toEqual([0x1f, 0x80]);
  });

  it('r8 -> r5 is a plain >>3 (255 -> 31)', () => {
    const word = packPixels16([{ r: 255, g: 0, b: 0 }], ChannelOrder.RGB);
    const w = word[0] | (word[1] << 8);
    expect((w >> 10) & 0x1f).toBe(31);
  });

  it('GRB order places G in slot1, R in slot2, B in slot3', () => {
    const out = packPixels16([{ r: 255, g: 0, b: 0 }], ChannelOrder.GRB);
    const w = out[0] | (out[1] << 8);
    expect((w >> 10) & 0x1f).toBe(0); // slot1 = g = 0
    expect((w >> 5) & 0x1f).toBe(31); // slot2 = r = 31
    expect(w & 0x1f).toBe(0); // slot3 = b = 0
  });

  it('default order (omitted) behaves as RGB', () => {
    const withDefault = packPixels16([{ r: 255, g: 128, b: 64 }]);
    const withExplicitRgb = packPixels16([{ r: 255, g: 128, b: 64 }], ChannelOrder.RGB);
    expect([...withDefault]).toEqual([...withExplicitRgb]);
  });
});

describe('buildConfig — full 20-byte CONFIG frame', () => {
  it('is header(12) + payload(8) = 20 bytes', () => {
    expect(buildConfig(80, 8, Wiring.SERPENTINE, Origin.TOP_LEFT, ChannelOrder.GRB).length).toBe(20);
  });

  it('byte-exact to the spec example: 80 cols x 8 rows, serpentine, top-left, GRB', () => {
    const f = buildConfig(80, 8, Wiring.SERPENTINE, Origin.TOP_LEFT, ChannelOrder.GRB);
    expect([...f]).toEqual([
      0x57, 0x4c, 0x01, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // header, count=0
      0x50, 0x00, 0x08, 0x00, 0x01, 0x00, 0x02, 0x00, // cols=80, rows=8, wiring=1, origin=0, order=2
    ]);
  });

  it('count field is 0 (CONFIG carries geometry, not an LED count)', () => {
    const f = buildConfig(40, 4, Wiring.LINEAR, Origin.TOP_LEFT, ChannelOrder.RGB);
    expect(f[10] | (f[11] << 8)).toBe(0);
  });
});

describe('buildDataFrame — flags + bpp dispatch', () => {
  const reds: RGB[] = [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 }];

  it('byte-exact to spec: timestamped RGB888, t=160ms, 3 LED (red,green,blue)', () => {
    const f = buildDataFrame(reds, { ts_ms: 160, timestamped: true, packed: false, latch: false });
    expect([...f]).toEqual([
      0x57, 0x4c, 0x01, 0x02, 0x00, 0x00, 0xa0, 0x00, 0x00, 0x00, 0x03, 0x00,
      0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff,
    ]);
  });

  it('byte-exact to spec: live PACKED16, 2 LED (red full, blue full), latch now', () => {
    const f = buildDataFrame([{ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }], {
      packed: true,
      latch: true,
    });
    expect([...f]).toEqual([
      0x57, 0x4c, 0x01, 0x09, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00,
      0x00, 0xfc, 0x1f, 0x80,
    ]);
  });

  it('flags: PAYLOAD_FMT bit set only when packed', () => {
    expect(buildDataFrame(reds, { packed: true })[3] & FLAG_PACKED16).toBe(FLAG_PACKED16);
    expect(buildDataFrame(reds, { packed: false })[3] & FLAG_PACKED16).toBe(0);
  });

  it('flags: RUN_MODE bit set only when timestamped', () => {
    expect(buildDataFrame(reds, { timestamped: true })[3] & FLAG_TIMESTAMPED).toBe(FLAG_TIMESTAMPED);
    expect(buildDataFrame(reds, { timestamped: false })[3] & FLAG_TIMESTAMPED).toBe(0);
  });

  it('flags: LATCH_NOW bit set only when latch', () => {
    expect(buildDataFrame(reds, { latch: true })[3] & FLAG_LATCH_NOW).toBe(FLAG_LATCH_NOW);
    expect(buildDataFrame(reds, { latch: false })[3] & FLAG_LATCH_NOW).toBe(0);
  });

  it('flags: CHANNEL_SWAP set for non-RGB order in RGB888 mode, never in PACKED16', () => {
    expect(buildDataFrame(reds, { packed: false, order: ChannelOrder.GRB })[3] & FLAG_CHANNEL_SWAP).toBe(FLAG_CHANNEL_SWAP);
    expect(buildDataFrame(reds, { packed: false, order: ChannelOrder.RGB })[3] & FLAG_CHANNEL_SWAP).toBe(0);
    expect(buildDataFrame(reds, { packed: true, order: ChannelOrder.GRB })[3] & FLAG_CHANNEL_SWAP).toBe(0);
  });

  it('bpp dispatch: RGB888 payload = count*3 bytes, PACKED16 = count*2 bytes', () => {
    const rgb = buildDataFrame(reds, { packed: false });
    const packed = buildDataFrame(reds, { packed: true });
    expect(rgb.length).toBe(HEADER_BYTES + reds.length * 3);
    expect(packed.length).toBe(HEADER_BYTES + reds.length * 2);
  });

  it('count field equals the number of LEDs, regardless of payload mode', () => {
    const f = buildDataFrame(reds, { packed: true });
    expect(f[10] | (f[11] << 8)).toBe(reds.length);
  });

  it('defaults: ts_ms=0, not timestamped, not packed, not latched, RGB order', () => {
    const f = buildDataFrame([{ r: 1, g: 2, b: 3 }]);
    const h = readHeader(f);
    expect(h.ts_ms).toBe(0);
    expect(h.flags).toBe(0);
    expect(f.length).toBe(HEADER_BYTES + 3); // RGB888
  });
});

describe('control frames — RESET / START / SENTINEL / BRIGHTNESS / HEARTBEAT', () => {
  it('RESET byte-exact to spec example', () => {
    expect([...buildReset()]).toEqual([
      0x57, 0x4c, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
  });

  it('START: type=0x02, count=0, no payload', () => {
    const f = buildStart();
    expect(f.length).toBe(HEADER_BYTES);
    expect(readHeader(f).type).toBe(FrameType.START);
  });

  it('SENTINEL: type=0x04 and always carries LATCH_NOW', () => {
    const f = buildSentinel();
    expect(f.length).toBe(HEADER_BYTES);
    const h = readHeader(f);
    expect(h.type).toBe(FrameType.SENTINEL);
    expect(h.flags & FLAG_LATCH_NOW).toBe(FLAG_LATCH_NOW);
  });

  it('BRIGHTNESS: type=0x05, count=0, but carries a 1-byte payload', () => {
    const f = buildBrightness(200);
    expect(f.length).toBe(HEADER_BYTES + 1);
    const h = readHeader(f);
    expect(h.type).toBe(FrameType.BRIGHTNESS);
    expect(h.count).toBe(0);
    expect(f[HEADER_BYTES]).toBe(200);
  });

  it('BRIGHTNESS clamps to 0..255', () => {
    expect(buildBrightness(999)[HEADER_BYTES]).toBe(255);
    expect(buildBrightness(-50)[HEADER_BYTES]).toBe(0);
  });

  it('HEARTBEAT: type=0x06, no payload', () => {
    const f = buildHeartbeat();
    expect(f.length).toBe(HEADER_BYTES);
    expect(readHeader(f).type).toBe(FrameType.HEARTBEAT);
  });
});
