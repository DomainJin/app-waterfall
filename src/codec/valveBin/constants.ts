// Valve .bin constants — byte-exact to CAU_TRUC_DU_LIEU.md + firmware handoff.

/** Reserved timestamp: clear queue, all valves off. Bytes: FF FF FF FF. */
export const TS_RESET = 0xffffffff;
/** Reserved timestamp: start clock, scheduler runs. Bytes: FE FF FF FF. */
export const TS_START = 0xfffffffe;
/** Reserved timestamp: CONFIG frame declaring valve_count. Bytes: FD FF FF FF.
 *  Payload = valve_count (u16 LE). Emitted FIRST (offset 0) so the firmware can
 *  derive the dynamic frame width before parsing RESET/START/data. Data
 *  timestamps are 0x00000000–0xFFFFFFFC. */
export const TS_CONFIG = 0xfffffffd;

/** Frame header = u32 LE timestamp; payload (bits) follows. */
export const FRAME_HEADER_BYTES = 4;
/** CONFIG frame is exactly 6 bytes: 4 (ts) + 2 (valve_count u16 LE). No pad. */
export const CONFIG_FRAME_BYTES = 6;
