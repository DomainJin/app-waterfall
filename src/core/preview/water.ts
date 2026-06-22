// Falling-water model for the preview. PURE + unit-tested — no DOM.
//
// A valve open at row r releases water at the top at t = r × row_ms. At the
// current time T that water has been falling for `age = T − t`. It accelerates
// under gravity, so vertical position is quadratic in age. After
// FALL_DURATION_MS it reaches the bottom and leaves the panel.

export const FALL_DURATION_MS = 1600;

/** Vertical position (0..H) of water with the given age. Quadratic = gravity. */
export function fallY(age_ms: number, H: number, fallDuration = FALL_DURATION_MS): number {
  const f = Math.min(1, Math.max(0, age_ms / fallDuration));
  return f * f * H;
}

/** Fall speed in px/ms (derivative of fallY) — used for motion-blur streaks. */
export function fallSpeed(age_ms: number, H: number, fallDuration = FALL_DURATION_MS): number {
  const f = Math.min(1, Math.max(0, age_ms / fallDuration));
  return ((2 * f) / fallDuration) * H;
}

/**
 * The single row "now" corresponds to: floor(T / row_ms), clamped to
 * [0, rows-1]. Shared by anything that just needs "what row is active right
 * now" rather than the valve's whole falling-water history (e.g. the LED
 * script, which only ever shows the current row's precomputed color).
 * Returns -1 if there's no valid row (no rows, or row_ms <= 0).
 */
export function currentRowAt(T: number, row_ms: number, rows: number): number {
  if (row_ms <= 0 || rows <= 0) return -1;
  return Math.min(rows - 1, Math.max(0, Math.floor(T / row_ms)));
}

/**
 * Rows whose water is still on the panel at time T: t ∈ [T − fallDuration, T].
 * Returns inclusive [r0, r1], clamped to [0, rows-1]; r1 < r0 means none.
 */
export function visibleRowRange(
  T: number,
  row_ms: number,
  rows: number,
  fallDuration = FALL_DURATION_MS,
): { r0: number; r1: number } {
  if (row_ms <= 0 || rows <= 0) return { r0: 0, r1: -1 };
  const r0 = Math.max(0, Math.ceil((T - fallDuration) / row_ms));
  const r1 = Math.min(rows - 1, Math.floor(T / row_ms));
  return { r0, r1 };
}

/** Is valve v open at row r in a flat boolean grid (rows × cols)? */
export function isValveOpen(
  grid: Uint8Array,
  r: number,
  v: number,
  cols: number,
): boolean {
  return grid[r * cols + v] === 1;
}
