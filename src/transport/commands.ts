// WebSocket text (JSON) commands for the valve controller (port 3333).
// App is Stream-mode only — SET_MODE is intentionally NOT emitted (firmware
// handoff §5). PURE string builders, no UI/socket imports.

/** Uppercase hex of a byte buffer (e.g. [0xff,0x00] -> "FF00"). */
export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0').toUpperCase();
  return s;
}

export function cmdAllOff(): string {
  return JSON.stringify({ cmd: 'ALL_OFF' });
}

export function cmdAllOn(): string {
  return JSON.stringify({ cmd: 'ALL_ON' });
}

export function cmdStreamStop(): string {
  return JSON.stringify({ cmd: 'STREAM_STOP' });
}

/**
 * Set one frame immediately. `bits` is valve_bytes_per_frame bytes, so the hex
 * is dynamic (valve_bytes_per_frame × 2 chars) — NOT a fixed 20 chars.
 */
export function cmdSet(bits: Uint8Array): string {
  return JSON.stringify({ cmd: 'SET', bits: bytesToHex(bits) });
}

/** Sync row_interval_ms down to the firmware scheduler. */
export function cmdSetTick(ms: number): string {
  return JSON.stringify({ cmd: 'SET_TICK', ms: Math.max(1, Math.round(ms)) });
}

/** Ask the firmware for its current valve_count + tickMs. */
export function cmdGetConfig(): string {
  return JSON.stringify({ cmd: 'GET_CONFIG' });
}
