// Types for the valve .bin codec.

/** A single valve transition for smooth (sub-frame) timing. */
export interface ValveEvent {
  /** ms timestamp of the transition (from TS_START). */
  t_ms: number;
  /** 0-indexed valve. */
  valve: number;
  /** true = open, false = close. */
  on: boolean;
}
