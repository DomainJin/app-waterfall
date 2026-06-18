import { CONFIG_FRAME_BYTES, FRAME_HEADER_BYTES, TS_CONFIG } from './constants';

// Low-level packing — PURE, no UI imports. Byte-exact to CAU_TRUC_DU_LIEU.md.

/**
 * Pack a CONFIG frame: 6 bytes = [FD FF FF FF][valve_count u16 LE]. No padding.
 *
 * Forward-compat note: the firmware parser reads the u32 ts first; if it equals
 * TS_CONFIG (0xFFFFFFFD) it reads 2 more bytes (this 6-byte frame), otherwise a
 * data frame is 4 + B bytes. The app only has to emit the correct order/length.
 */
export function packConfigFrame(valveCount: number): Uint8Array {
  const frame = new Uint8Array(CONFIG_FRAME_BYTES);
  const view = new DataView(frame.buffer);
  view.setUint32(0, TS_CONFIG >>> 0, true); // FD FF FF FF (LE)
  view.setUint16(4, valveCount & 0xffff, true); // valve_count (LE), e.g. 320 -> 40 01
  return frame;
}

/**
 * Pack one frame: u32 LE `ts_ms` followed by the `bits` bytes.
 * Frame length = 4 + bits.length (i.e. 4 + B). Endian is Little-Endian.
 */
export function packFrame(ts_ms: number, bits: Uint8Array): Uint8Array {
  const frame = new Uint8Array(FRAME_HEADER_BYTES + bits.length);
  // DataView writes LE; >>> 0 forces unsigned (handles TS_RESET/TS_START).
  new DataView(frame.buffer).setUint32(0, ts_ms >>> 0, true);
  frame.set(bits, FRAME_HEADER_BYTES);
  return frame;
}

/**
 * Pack a list of 0-indexed open valves into B bytes, MSB first:
 *   buf[v >> 3] |= 1 << (7 - (v & 7))
 * bit 7 of byte 0 = first valve of each board. Buffer length is dynamic (B);
 * valves outside [0, B*8) are ignored, so trailing bits stay 0.
 */
export function valveBits(valves: number[], B: number): Uint8Array {
  const buf = new Uint8Array(B);
  const maxValve = B * 8;
  for (const v of valves) {
    if (v < 0 || v >= maxValve) continue;
    buf[v >> 3] |= 1 << (7 - (v & 7));
  }
  return buf;
}
