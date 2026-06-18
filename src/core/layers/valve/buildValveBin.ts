import {
  buildAnimationGrid,
  buildAnimationSmooth,
} from '../../../codec/valveBin';
import { gridToEvents, gridToRows } from './convert';
import { sampleFrameToGrid, type FrameLike } from './sample';
import { applyPaint } from './threshold';

export type ValveMode = 'grid' | 'smooth';

export interface BuildValveBinParams {
  /** Reads the valve layer's effective frame at time t (may be null). */
  frameAt: (t_ms: number) => Promise<FrameLike | null>;
  /** valve_cols (spatial). */
  cols: number;
  /** number of time rows (duration / row_interval_ms). */
  rows: number;
  /** ms per row. */
  row_ms: number;
  /** valve_bytes_per_frame. */
  B: number;
  /** 0..1 luminance cutoff. */
  threshold: number;
  /** absolute-index (r*cols+c) manual overrides. */
  paint?: Record<number, boolean>;
  mode: ValveMode;
}

/**
 * Build the full valve .bin by sampling one source frame per time row. Each
 * row r reads the frame at t = r*row_ms, samples it into `cols` cells
 * (collapsing vertical), thresholds, then applies manual paint overrides.
 *
 * Impure only via the injected `frameAt`; unit-testable with a mock source.
 */
export async function buildValveBin(p: BuildValveBinParams): Promise<Uint8Array> {
  const { frameAt, cols, rows, row_ms, B, threshold, paint, mode } = p;

  const bool = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const img = await frameAt(r * row_ms);
    if (!img) continue; // no source -> row stays all-off
    const intensity = sampleFrameToGrid(img, cols, 1);
    for (let c = 0; c < cols; c++) {
      bool[r * cols + c] = intensity[c] >= threshold ? 1 : 0;
    }
  }

  const grid = paint ? applyPaint(bool, paint) : bool;

  // valve_count for the CONFIG frame = valve_cols (the spatial count).
  return mode === 'smooth'
    ? buildAnimationSmooth(gridToEvents(grid, cols, rows, row_ms), row_ms, B, cols)
    : buildAnimationGrid(gridToRows(grid, cols, rows), row_ms, B, cols);
}
