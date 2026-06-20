import { create } from 'zustand';
import type { ValveMode } from '../../core/layers/valve';

// Valve layer settings. `paint` maps absolute cell index (r*cols + c) to a
// forced on/off; absent = use the video-thresholded value.
interface ValveState {
  threshold: number; // 0..1
  /** Flip the threshold: dark-on-light source -> the dark shape is water,
   *  not the background. Default off (bright -> on, the old behaviour). */
  invert: boolean;
  /** Mirror left<->right within the active band. Default off. */
  flipH: boolean;
  /** Scan bottom-to-top instead of top-to-bottom. Default off. */
  flipV: boolean;
  mode: ValveMode;
  paint: Record<number, boolean>;

  // Precomputed grid (rows × cols, flat) — see computeFullGrid. Play, the
  // preview, and .bin export all read this same array; null until the first
  // compute finishes. gridRows/gridCols record the shape it was computed
  // with, so consumers can tell a still-valid grid from a stale one.
  valveGrid: Uint8Array | null;
  gridRows: number;
  gridCols: number;
  computing: boolean;
  /** 0..1, meaningful only while `computing` is true. */
  progress: number;

  setThreshold: (t: number) => void;
  setInvert: (invert: boolean) => void;
  setFlipH: (flipH: boolean) => void;
  setFlipV: (flipV: boolean) => void;
  setMode: (m: ValveMode) => void;
  /** Cycle a cell: none -> forced on -> forced off -> none. */
  togglePaint: (index: number) => void;
  /** Shift+click power-user gesture: cycle the SAME none->on->off->none
   *  state (anchored on baseRow's current cell), applied uniformly to every
   *  row in `col` — a deliberate whole-column override, not the default. */
  paintColumn: (col: number, cols: number, rows: number, baseRow: number) => void;
  clearPaint: () => void;

  setComputing: (computing: boolean) => void;
  setProgress: (fraction: number) => void;
  setGridResult: (grid: Uint8Array, rows: number, cols: number) => void;
}

export const useValveStore = create<ValveState>((set) => ({
  threshold: 0.5,
  invert: false,
  flipH: false,
  flipV: false,
  mode: 'grid',
  paint: {},

  valveGrid: null,
  gridRows: 0,
  gridCols: 0,
  computing: false,
  progress: 0,

  setThreshold: (t) =>
    set({ threshold: Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0.5 }),
  setInvert: (invert) => set({ invert }),
  setFlipH: (flipH) => set({ flipH }),
  setFlipV: (flipV) => set({ flipV }),
  setMode: (m) => set({ mode: m === 'smooth' ? 'smooth' : 'grid' }),
  togglePaint: (index) =>
    set((s) => {
      const paint = { ...s.paint };
      if (!(index in paint)) paint[index] = true;
      else if (paint[index]) paint[index] = false;
      else delete paint[index];
      return { paint };
    }),
  paintColumn: (col, cols, rows, baseRow) =>
    set((s) => {
      const paint = { ...s.paint };
      const baseIdx = baseRow * cols + col;
      // none -> forced on -> forced off -> none, same cycle as togglePaint.
      let next: boolean | undefined;
      if (!(baseIdx in paint)) next = true;
      else if (paint[baseIdx]) next = false;
      else next = undefined;
      for (let r = 0; r < rows; r++) {
        const idx = r * cols + col;
        if (next === undefined) delete paint[idx];
        else paint[idx] = next;
      }
      return { paint };
    }),
  clearPaint: () => set({ paint: {} }),

  setComputing: (computing) => set({ computing }),
  setProgress: (fraction) => set({ progress: Math.min(1, Math.max(0, fraction)) }),
  setGridResult: (grid, rows, cols) =>
    set({ valveGrid: grid, gridRows: rows, gridCols: cols }),
}));
