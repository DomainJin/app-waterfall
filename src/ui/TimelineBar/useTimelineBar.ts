import { useCallback, useEffect, useRef } from 'react';
import { useTimelineStore } from '../../store/timeline';
import { useValveStore } from '../../store/valve';

// State wiring for the timeline bar. The clock advances via rAF independently;
// this only reflects + commands it.
export function useTimelineBar() {
  const positionMs = useTimelineStore((s) => s.positionMs);
  const durationMs = useTimelineStore((s) => s.durationMs);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const fps = useTimelineStore((s) => s.fps);

  const toggle = useTimelineStore((s) => s.toggle);
  const stop = useTimelineStore((s) => s.stop);
  const seek = useTimelineStore((s) => s.seek);
  const stepFrame = useTimelineStore((s) => s.stepFrame);
  const setDurationMs = useTimelineStore((s) => s.setDurationMs);
  const setFps = useTimelineStore((s) => s.setFps);

  // The valve grid is precomputed up front (see useValveGridCompute) — Play
  // is disabled until it's ready, since playback only ever reads that array.
  const computing = useValveStore((s) => s.computing);
  const progress = useValveStore((s) => s.progress);

  // The scrub <input type=range> can fire 'input' far faster than rAF (mouse
  // move granularity, not vsync). Every seek() fans out synchronously to the
  // LED device stream, the audio element's currentTime, and the preview IPC
  // push — calling seek() once per raw input event backlogs all three. Coalesce
  // rapid drags to one seek() per animation frame (always the LATEST value),
  // the same cadence those consumers already get from playback's own rAF tick.
  const pendingMsRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const scrub = useCallback(
    (ms: number) => {
      pendingMsRef.current = ms;
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (pendingMsRef.current !== null) seek(pendingMsRef.current);
      });
    },
    [seek],
  );

  useEffect(
    () => () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    },
    [],
  );

  return {
    positionMs,
    durationMs,
    isPlaying,
    fps,
    computing,
    progress,
    toggle,
    stop,
    seek,
    scrub,
    stepFrame,
    setDurationMs,
    setFps,
  };
}
