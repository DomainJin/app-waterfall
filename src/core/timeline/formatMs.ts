/** Format ms as `mm:ss.mmm` (pure helper for readouts). */
export function formatMs(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalMs = Math.floor(safe);
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  return `${pad(m, 2)}:${pad(s, 2)}.${pad(millis, 3)}`;
}
