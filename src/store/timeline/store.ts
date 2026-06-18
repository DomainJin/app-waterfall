import { create } from 'zustand';
import { masterClock } from './clock';

// Mirrors the master clock's snapshot so components can render the position /
// transport state. The clock owns the truth; this store is a projection, with
// actions delegating to the clock.
interface TimelineState {
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  rate: number;
  fps: number;

  play: () => void;
  pause: () => void;
  toggle: () => void;
  stop: () => void;
  seek: (ms: number) => void;
  stepFrame: (direction: number) => void;
  setDurationMs: (ms: number) => void;
  setFps: (fps: number) => void;
}

export const useTimelineStore = create<TimelineState>((set) => {
  // Clock -> store. The clock owns the truth; the store is a projection.
  masterClock.subscribe((snap) => set(snap));

  return {
    ...masterClock.snapshot(),

    play: () => masterClock.play(),
    pause: () => masterClock.pause(),
    toggle: () => masterClock.toggle(),
    stop: () => masterClock.stop(),
    seek: (ms) => masterClock.seek(ms),
    stepFrame: (direction) => masterClock.stepFrame(direction),
    setDurationMs: (ms) => masterClock.setDuration(ms),
    setFps: (fps) => masterClock.setFps(fps),
  };
});
