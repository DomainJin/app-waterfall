import { create } from 'zustand';
import type { ValveMode } from '../../core/layers/valve';

// Valve layer settings. `paint` maps absolute cell index (r*cols + c) to a
// forced on/off; absent = use the video-thresholded value.
interface ValveState {
  threshold: number; // 0..1
  mode: ValveMode;
  paint: Record<number, boolean>;

  setThreshold: (t: number) => void;
  setMode: (m: ValveMode) => void;
  /** Cycle a cell: none -> forced on -> forced off -> none. */
  togglePaint: (index: number) => void;
  clearPaint: () => void;
}

export const useValveStore = create<ValveState>((set) => ({
  threshold: 0.5,
  mode: 'grid',
  paint: {},

  setThreshold: (t) =>
    set({ threshold: Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0.5 }),
  setMode: (m) => set({ mode: m === 'smooth' ? 'smooth' : 'grid' }),
  togglePaint: (index) =>
    set((s) => {
      const paint = { ...s.paint };
      if (!(index in paint)) paint[index] = true;
      else if (paint[index]) paint[index] = false;
      else delete paint[index];
      return { paint };
    }),
  clearPaint: () => set({ paint: {} }),
}));
