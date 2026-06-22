// IC9803 / LPD6803 LED wire-format codec — the WebSocket binary protocol
// for LED frames, sent over the SAME socket as valve (port 3333; the
// firmware tells frames apart by the magic bytes below vs. valve's
// magic-less frames). PURE, no UI/IO imports. Byte-exact to 03_LED_WIRE_FORMAT.md.

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export const MAGIC0 = 0x57; // 'W'
export const MAGIC1 = 0x4c; // 'L'
export const PROTO_VERSION = 0x01;
export const HEADER_BYTES = 12;
export const CONFIG_PAYLOAD_BYTES = 8;

export const FrameType = {
  DATA: 0x00,
  RESET: 0x01,
  START: 0x02,
  CONFIG: 0x03,
  SENTINEL: 0x04,
  BRIGHTNESS: 0x05,
  HEARTBEAT: 0x06,
} as const;
export type FrameType = (typeof FrameType)[keyof typeof FrameType];

/** flags bitfield (§2). */
export const FLAG_PACKED16 = 1 << 0; // PAYLOAD_FMT:   0=RGB888,  1=PACKED16
export const FLAG_TIMESTAMPED = 1 << 1; // RUN_MODE:    0=LIVE,    1=TIMESTAMPED
export const FLAG_CHANNEL_SWAP = 1 << 2; // CHANNEL_SWAP: 0=RGB,    1=use `order`
export const FLAG_LATCH_NOW = 1 << 3; // flush to LED immediately after this frame

export const ChannelOrder = {
  RGB: 0x00,
  RBG: 0x01,
  GRB: 0x02,
  GBR: 0x03,
  BRG: 0x04,
  BGR: 0x05,
} as const;
export type ChannelOrder = (typeof ChannelOrder)[keyof typeof ChannelOrder];

export const Wiring = { LINEAR: 0, SERPENTINE: 1 } as const;
export type Wiring = (typeof Wiring)[keyof typeof Wiring];

export const Origin = {
  TOP_LEFT: 0,
  TOP_RIGHT: 1,
  BOTTOM_LEFT: 2,
  BOTTOM_RIGHT: 3,
} as const;
export type Origin = (typeof Origin)[keyof typeof Origin];

/**
 * Fixed 12-byte header: magic "WL", version, flags, type, reserved=0,
 * ts_ms (u32 LE), count (u16 LE). All multi-byte fields Little-Endian.
 */
export function buildHeader(
  type: number,
  flags: number,
  ts_ms: number,
  count: number,
): Uint8Array {
  const h = new Uint8Array(HEADER_BYTES);
  h[0] = MAGIC0;
  h[1] = MAGIC1;
  h[2] = PROTO_VERSION;
  h[3] = flags & 0xff;
  h[4] = type & 0xff;
  h[5] = 0x00; // reserved
  const view = new DataView(h.buffer);
  view.setUint32(6, ts_ms >>> 0, true);
  view.setUint16(10, count & 0xffff, true);
  return h;
}

/**
 * RGB888 payload: literal `R G B` bytes per LED, in that order. Channel
 * reordering for this mode is the FIRMWARE's job (driven by CONFIG's `order`
 * field, gated by the CHANNEL_SWAP flag — see buildDataFrame) — the app
 * never permutes bytes here.
 */
export function packPixelsRGB888(cells: RGB[]): Uint8Array {
  const out = new Uint8Array(cells.length * 3);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    out[i * 3] = c.r & 0xff;
    out[i * 3 + 1] = c.g & 0xff;
    out[i * 3 + 2] = c.b & 0xff;
  }
  return out;
}

// The three letters of `order` ARE the per-slot assignment of the 16-bit
// IC9803 word: slot1 = bits 14-10, slot2 = bits 9-5, slot3 = bits 4-0.
// e.g. GRB -> slot1 reads G, slot2 reads R, slot3 reads B.
function orderedChannels(
  order: ChannelOrder,
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  switch (order) {
    case ChannelOrder.RBG:
      return [r, b, g];
    case ChannelOrder.GRB:
      return [g, r, b];
    case ChannelOrder.GBR:
      return [g, b, r];
    case ChannelOrder.BRG:
      return [b, r, g];
    case ChannelOrder.BGR:
      return [b, g, r];
    case ChannelOrder.RGB:
    default:
      return [r, g, b];
  }
}

/**
 * PACKED16 payload: each LED a 16-bit IC9803 word, Little-Endian —
 * `bit15=1 | R5<<10 | G5<<5 | B5`. The app pre-applies `order` here (the
 * ESP32 pushes the word straight through with no per-pixel computation).
 */
export function packPixels16(
  cells: RGB[],
  order: ChannelOrder = ChannelOrder.RGB,
): Uint8Array {
  const out = new Uint8Array(cells.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const [s1, s2, s3] = orderedChannels(order, c.r & 0xff, c.g & 0xff, c.b & 0xff);
    const word = 0x8000 | ((s1 >> 3) << 10) | ((s2 >> 3) << 5) | (s3 >> 3);
    view.setUint16(i * 2, word, true);
  }
  return out;
}

/** CONFIG frame (full, 20 bytes): header(12) + matrix geometry payload(8). */
export function buildConfig(
  led_cols: number,
  led_rows: number,
  wiring: Wiring,
  origin: Origin,
  order: ChannelOrder,
): Uint8Array {
  const header = buildHeader(FrameType.CONFIG, 0, 0, 0);
  const payload = new Uint8Array(CONFIG_PAYLOAD_BYTES);
  const view = new DataView(payload.buffer);
  view.setUint16(0, led_cols & 0xffff, true);
  view.setUint16(2, led_rows & 0xffff, true);
  payload[4] = wiring & 0xff;
  payload[5] = origin & 0xff;
  payload[6] = order & 0xff;
  payload[7] = 0x00; // reserved
  const out = new Uint8Array(HEADER_BYTES + CONFIG_PAYLOAD_BYTES);
  out.set(header, 0);
  out.set(payload, HEADER_BYTES);
  return out;
}

export interface DataFrameOptions {
  ts_ms?: number;
  timestamped?: boolean;
  packed?: boolean;
  latch?: boolean;
  order?: ChannelOrder;
}

/**
 * DATA frame (full): header + pixel payload.
 * - PACKED16: `order` is baked directly into the words (packPixels16).
 * - RGB888: payload stays literal R,G,B; CHANNEL_SWAP is set whenever
 *   `order` isn't the RGB identity, telling the firmware to permute using
 *   whatever `order` it cached from the last CONFIG frame.
 */
export function buildDataFrame(cells: RGB[], opts: DataFrameOptions = {}): Uint8Array {
  const ts_ms = opts.ts_ms ?? 0;
  const timestamped = opts.timestamped ?? false;
  const packed = opts.packed ?? false;
  const latch = opts.latch ?? false;
  const order = opts.order ?? ChannelOrder.RGB;

  let flags = 0;
  if (packed) flags |= FLAG_PACKED16;
  if (timestamped) flags |= FLAG_TIMESTAMPED;
  if (latch) flags |= FLAG_LATCH_NOW;
  if (!packed && order !== ChannelOrder.RGB) flags |= FLAG_CHANNEL_SWAP;

  const header = buildHeader(FrameType.DATA, flags, ts_ms, cells.length);
  const payload = packed ? packPixels16(cells, order) : packPixelsRGB888(cells);
  const out = new Uint8Array(header.length + payload.length);
  out.set(header, 0);
  out.set(payload, header.length);
  return out;
}

export function buildReset(): Uint8Array {
  return buildHeader(FrameType.RESET, 0, 0, 0);
}

export function buildStart(): Uint8Array {
  return buildHeader(FrameType.START, 0, 0, 0);
}

/** SENTINEL always carries LATCH_NOW (§5: flushes to black on stream end). */
export function buildSentinel(): Uint8Array {
  return buildHeader(FrameType.SENTINEL, FLAG_LATCH_NOW, 0, 0);
}

/** BRIGHTNESS: count=0 (not an LED count) but carries a 1-byte payload. */
export function buildBrightness(v: number): Uint8Array {
  const header = buildHeader(FrameType.BRIGHTNESS, 0, 0, 0);
  const out = new Uint8Array(header.length + 1);
  out.set(header, 0);
  out[header.length] = Math.max(0, Math.min(255, Math.round(v)));
  return out;
}

export function buildHeartbeat(): Uint8Array {
  return buildHeader(FrameType.HEARTBEAT, 0, 0, 0);
}
