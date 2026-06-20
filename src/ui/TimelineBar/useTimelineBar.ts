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
    stepFrame,
    setDurationMs,
    setFps,
  };
}
