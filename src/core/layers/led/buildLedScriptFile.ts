// Exports the precomputed LED script (see script.ts) to a file firmware can
// replay — literally a concatenation of the SAME wire-format frames
// (03_LED_WIRE_FORMAT.md) sent live over the device socket (see
// store/led/store.ts's sendNow), so file playback and live streaming are
// byte-identical by construction: one CONFIG frame, then one timestamped
// DATA frame per row, then SENTINEL. No new ad hoc format for firmware to
// learn — it already has a parser for this wire format.
import {
  buildConfig,
  buildDataFrame,
  buildSentinel,
  type ChannelOrder,
  type Origin,
  type Wiring,
} from '../../../codec/ic9803';
import { readLedScriptRow } from './script';

export interface BuildLedScriptFileParams {
  /** Precomputed LED script (rows × cols × 3, flat) — see computeLedScript. */
  script: Uint8Array;
  rows: number;
  cols: number;
  /** ms per row — the same row_ms the valve grid and LED script share. */
  row_ms: number;
  wiring: Wiring;
  origin: Origin;
  channelOrder: ChannelOrder;
  payloadMode: 'rgb888' | 'packed16';
}

/** Builds the full exportable LED file from an already-computed script — the
 *  SAME script the editor preview and live device stream read, so the file,
 *  the preview, and live playback are WYSIWYG-identical by construction. */
export function buildLedScriptFile(p: BuildLedScriptFileParams): Uint8Array {
  const { script, rows, cols, row_ms, wiring, origin, channelOrder, payloadMode } = p;
  const packed = payloadMode === 'packed16';

  // LED is always a 1D strip — led_rows=1 in CONFIG (LED_ACTUAL_SPEC.md §5),
  // the same convention store/led/store.ts's sendNow() uses for the live stream.
  const frames: Uint8Array[] = [buildConfig(cols, 1, wiring, origin, channelOrder)];
  for (let r = 0; r < rows; r++) {
    frames.push(
      buildDataFrame(readLedScriptRow(script, r, cols), {
        ts_ms: r * row_ms,
        timestamped: true,
        packed,
        latch: true,
        order: channelOrder,
      }),
    );
  }
  frames.push(buildSentinel());

  const total = frames.reduce((sum, f) => sum + f.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const f of frames) {
    out.set(f, offset);
    offset += f.length;
  }
  return out;
}
