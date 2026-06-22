// Pure timing math for syncing an audio element to the master clock. No DOM —
// testable without a real <audio> element.

/** Where the audio element's currentTime should be for a given timeline
 *  position + user offset (ms). Negative results clamp to 0 — there is
 *  nothing to play before the timeline starts. */
export function targetAudioSec(positionMs: number, offsetMs: number): number {
  const ms = positionMs + offsetMs;
  return Number.isFinite(ms) && ms > 0 ? ms / 1000 : 0;
}

/** Whether currentTime has drifted far enough from target to warrant a
 *  hard seek. A tolerance avoids re-seeking (and the resulting audio
 *  glitch) on every single clock tick during normal playback. */
export function needsResync(currentSec: number, targetSec: number, toleranceSec = 0.15): boolean {
  return Math.abs(currentSec - targetSec) > toleranceSec;
}
