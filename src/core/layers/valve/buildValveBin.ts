import {
  buildAnimationGrid,
  buildAnimationSmooth,
} from '../../../codec/valveBin';
import { gridToEvents, gridToRows } from './convert';

export type ValveMode = 'grid' | 'smooth';

export interface BuildValveBinParams {
  /** Precomputed valve grid (rows × cols, flat) — see computeFullGrid. Already
   *  thresholded, painted, and edge-masked. */
  grid: Uint8Array;
  /** valve_cols (spatial). */
  cols: number;
  /** number of time rows (duration / row_interval_ms). */
  rows: number;
  /** ms per row. */
  row_ms: number;
  /** valve_bytes_per_frame. */
  B: number;
  mode: ValveMode;
}

/**
 * Build the full valve .bin from an already-computed grid — the SAME grid
 * the preview renders and Play reads, so the .bin, the preview, and live
 * playback are WYSIWYG-identical by construction (one shared source of
 * truth instead of three separate re-samples of the video).
 */
export function buildValveBin(p: BuildValveBinParams): Uint8Array {
  const { grid, cols, rows, row_ms, B, mode } = p;

  // valve_count for the CONFIG frame = valve_cols (the spatial count) — the
  // margin is app-side only and never changes the .bin / valve_count.
  return mode === 'smooth'
    ? buildAnimationSmooth(gridToEvents(grid, cols, rows, row_ms), row_ms, B, cols)
    : buildAnimationGrid(gridToRows(grid, cols, rows), row_ms, B, cols);
}
