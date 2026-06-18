// Threshold + manual paint override. PURE.

/** intensity[i] >= threshold -> valve on (1). */
export function thresholdGrid(
  intensity: Float32Array,
  threshold: number,
): Uint8Array {
  const out = new Uint8Array(intensity.length);
  for (let i = 0; i < intensity.length; i++) {
    out[i] = intensity[i] >= threshold ? 1 : 0;
  }
  return out;
}

/**
 * Apply manual paint overrides on top of a boolean grid. `overrides` is keyed
 * by absolute cell index (r*cols + c); each entry forces that cell on/off.
 * Returns a new array (does not mutate the input).
 */
export function applyPaint(
  bool: Uint8Array,
  overrides: Record<number, boolean>,
): Uint8Array {
  const out = bool.slice();
  for (const key of Object.keys(overrides)) {
    const idx = Number(key);
    if (idx >= 0 && idx < out.length) out[idx] = overrides[idx] ? 1 : 0;
  }
  return out;
}
