// Read-direction tick sync: GET http://<ip>:8080/version → { tickMs, ... }.
// tickMs is the firmware's mechanical valve floor; the app uses it as the
// minimum for row_interval_ms (handoff §4).

export interface DeviceVersion {
  /** Mechanical tick floor in ms, or null if absent/unknown. */
  tickMs: number | null;
  /** Firmware's current valve_count, or null. */
  valveCount: number | null;
  raw: unknown;
}

/** Pure: extract the fields we care about from a /version JSON body. */
export function parseVersion(json: unknown): DeviceVersion {
  const obj = (json ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    tickMs: num(obj.tickMs),
    // accept either snake_case (firmware) or camelCase, for robustness.
    valveCount: num(obj.valve_count) ?? num(obj.valveCount),
    raw: json,
  };
}

/**
 * Fetch /version. Returns null on any failure (no device yet) so callers can
 * keep their defaults and not block. `fetchImpl` is injectable for tests.
 */
export async function fetchVersion(
  ip: string,
  port = 8080,
  fetchImpl: typeof fetch = fetch,
): Promise<DeviceVersion | null> {
  try {
    const res = await fetchImpl(`http://${ip}:${port}/version`);
    if (!res.ok) return null;
    return parseVersion(await res.json());
  } catch {
    return null;
  }
}
