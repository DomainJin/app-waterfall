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
  /** Total animation duration in ms. When provided, valve_rows is derived. */
  duration_ms?: number;
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
  /** Temporal resolution actually used (ms). */
  row_interval_ms: number;
  /** 0 or 1. */
  valveIndexBase: ValveIndexBase;
  /** ceil(duration_ms / row_interval_ms) when duration given, else null. */
  valve_rows: number | null;
}
