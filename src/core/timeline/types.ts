// Types for the master timeline clock.

export interface ClockSnapshot {
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  rate: number;
  fps: number;
}

export type ClockListener = (snapshot: ClockSnapshot) => void;

export interface MasterClockOptions {
  durationMs?: number;
  fps?: number;
  /** Injectable time source (ms). Defaults to performance.now(). */
  now?: () => number;
}
