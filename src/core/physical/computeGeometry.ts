// Pure geometry derivation: curtain length (m) -> all layer resolutions.
// No UI imports, no side effects.
import {
  DEFAULT_CURTAIN_HEIGHT_M,
  DEFAULT_LED_ROWS,
  DEFAULT_ROW_INTERVAL_MS,
  GRAVITY_M_S2,
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
  const edge_margin =
    opts.edge_margin != null && opts.edge_margin > 0
      ? Math.floor(opts.edge_margin)
      : 0;

  const valve_cols = Math.round(len * VALVES_PER_METER);
  const led_cols = Math.round(len * LEDS_PER_METER);

  // Margin is app-side only: valve_cols (and thus the .bin / valve_count) is
  // unchanged; only the usable middle band shrinks.
  const active_cols = Math.max(0, valve_cols - 2 * edge_margin);
  const marginValid = edge_margin === 0 || 2 * edge_margin < valve_cols;

  const derivedBytes = Math.ceil(valve_cols / 8);
  const valve_bytes_per_frame = fixedFrameBytes ?? derivedBytes;

  const valve_rows =
    opts.duration_ms != null && opts.duration_ms >= 0
      ? Math.ceil(nonNegative(opts.duration_ms) / row_interval_ms)
      : null;

  const curtain_height_m =
    opts.curtain_height_m != null && opts.curtain_height_m > 0
      ? opts.curtain_height_m
      : DEFAULT_CURTAIN_HEIGHT_M;
  // Free fall from rest: h = ½gt² → t = √(2h/g).
  const fall_time_ms = Math.sqrt((2 * curtain_height_m) / GRAVITY_M_S2) * 1000;
  const visible_rows = Math.floor(fall_time_ms / row_interval_ms);
  const frame_duration_ms = visible_rows * row_interval_ms;

  return {
    length_m: len,
    valve_cols,
    led_cols,
    valve_bytes_per_frame,
    fixedFrameBytes,
    led_rows,
    edge_margin,
    active_cols,
    marginValid,
    row_interval_ms,
    valveIndexBase,
    valve_rows,
    curtain_height_m,
    fall_time_ms,
    visible_rows,
    frame_duration_ms,
  };
}
