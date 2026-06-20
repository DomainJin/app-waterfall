// Types for physical geometry derivation.

export type ValveIndexBase = 0 | 1;

export interface GeometryOptions {
  /** Temporal resolution in ms. Default DEFAULT_ROW_INTERVAL_MS. */
  row_interval_ms?: number;
  /** If firmware expects a fixed byte count regardless of valve_cols, force
   *  it. null/0/undefined = OFF (derive from valve_cols). */
  fixedFrameBytes?: number | null;
  /** 0- or 1-indexed valve numbering, kept consistent across the codebase. */
  valveIndexBase?: ValveIndexBase;
  /** LED matrix height (vertical pixels). Default DEFAULT_LED_ROWS. */
  led_rows?: number;
  /** Valves disabled per side (symmetric). App-side only — does NOT change
   *  valve_cols or the .bin. Default 0. */
  edge_margin?: number;
  /** Total animation duration in ms. When provided, valve_rows is derived. */
  duration_ms?: number;
  /** Curtain height (m) — how far water falls top to bottom. Default
   *  DEFAULT_CURTAIN_HEIGHT_M. */
  curtain_height_m?: number;
}

export interface Geometry {
  length_m: number;
  /** round(length_m × 40). */
  valve_cols: number;
  /** round(length_m × 10). */
  led_cols: number;
  /** ceil(valve_cols / 8), or fixedFrameBytes when forced. */
  valve_bytes_per_frame: number;
  /** Whether valve_bytes_per_frame was forced by fixedFrameBytes. */
  fixedFrameBytes: number | null;
  /** LED matrix height. */
  led_rows: number;
  /** Valves disabled per side (symmetric). App-side only. */
  edge_margin: number;
  /** valve_cols − 2 × edge_margin. Video maps 100% into this middle band. */
  active_cols: number;
  /** False when 2 × edge_margin ≥ valve_cols (active_cols ≤ 0). */
  marginValid: boolean;
  /** Temporal resolution actually used (ms). */
  row_interval_ms: number;
  /** 0 or 1. */
  valveIndexBase: ValveIndexBase;
  /** ceil(duration_ms / row_interval_ms) when duration given, else null. */
  valve_rows: number | null;
  /** Curtain height (m). The waterfall acts like a vertical line printer —
   *  rows scan over time, water falls under gravity; height sets fall speed
   *  and how many rows are visible at once. */
  curtain_height_m: number;
  /** Time (ms) for a drop to fall the full curtain height:
   *  sqrt(2 × curtain_height_m / g) × 1000. */
  fall_time_ms: number;
  /** floor(fall_time_ms / row_interval_ms) — rows simultaneously visible on
   *  the curtain at any instant (newest at top, oldest near the bottom). */
  visible_rows: number;
  /** visible_rows × row_interval_ms — the ms span one full "frame" of video
   *  needs to scan to cover the whole curtain height once. */
  frame_duration_ms: number;
}
