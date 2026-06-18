/** Clamp a time (ms) into [0, durationMs]. Pure — unit-tested. */
export function clampTimeMs(t_ms: number, durationMs: number): number {
  if (!Number.isFinite(t_ms) || t_ms < 0) return 0;
  if (durationMs > 0 && t_ms > durationMs) return durationMs;
  return t_ms;
}
