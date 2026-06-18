// Pure geometry derivation: curtain length (m) -> all layer resolutions.
// No UI imports, no side effects.
import {
  DEFAULT_LED_ROWS,
  DEFAULT_ROW_INTERVAL_MS,
  LEDS_PER_METER,
  VALVES_PER_METER,
} from './constants';
import type { Geometry, GeometryOptions, ValveIndexBase } from './types';

/** Coerce to a finite, non-negative number; invalid -> 0. */
function nonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Derive all layer geometry from the curtain length. Pure: same inputs
 * always produce the same output, with no side effects.
 */
export function computeGeometry(
  length_m: number,
  opts: GeometryOptions = {},
): Geometry {
  const len = nonNegative(length_m);

  const row_interval_ms =
    opts.row_interval_ms != null && opts.row_interval_ms > 0
      ? opts.row_interval_ms
      : DEFAULT_ROW_INTERVAL_MS;
  const valveIndexBase: ValveIndexBase = opts.valveIndexBase === 1 ? 1 : 0;
  const led_rows =
    opts.led_rows != null && opts.led_rows > 0
      ? Math.floor(opts.led_rows)
      : DEFAULT_LED_ROWS;
  const fixedFrameBytes =
    opts.fixedFrameBytes != null && opts.fixedFrameBytes > 0
      ? Math.floor(opts.fixedFrameBytes)
      : null;

  const valve_cols = Math.round(len * VALVES_PER_METER);
  const led_cols = Math.round(len * LEDS_PER_METER);

  const derivedBytes = Math.ceil(valve_cols / 8);
  const valve_bytes_per_frame = fixedFrameBytes ?? derivedBytes;

  const valve_rows =
    opts.duration_ms != null && opts.duration_ms >= 0
      ? Math.ceil(nonNegative(opts.duration_ms) / row_interval_ms)
      : null;

  return {
    length_m: len,
    valve_cols,
    led_cols,
    valve_bytes_per_frame,
    fixedFrameBytes,
    led_rows,
    row_interval_ms,
    valveIndexBase,
    valve_rows,
  };
}
