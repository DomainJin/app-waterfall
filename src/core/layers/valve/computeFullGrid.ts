import { frameToValveRow, maskEdges } from './marginMap';
import type { FrameLike } from './sample';
import { applyPaint } from './threshold';

// Conservative default when the source's true frame rate isn't known. Only
// affects HOW MANY rows reuse one video seek (perf), never correctness: a
// wrong guess just means a row near a real frame boundary may hold the
// previous frame's content for up to one row_ms longer than ideal.
export const ASSUMED_VIDEO_FPS = 30;

export interface ComputeFullGridParams {
  /** Reads the valve layer's effective frame at time t (may be null). */
  frameAt: (t_ms: number) => Promise<FrameLike | null>;
  cols: number;
  rows: number;
  row_ms: number;
  threshold: number;
  paint?: Record<number, boolean>;
  edge_margin?: number;
  /** Source video's native frame rate — used only for the seek-reuse optimization below. */
  video_fps?: number;
  /** Called with a 0..1 fraction as rows complete. */
  onProgress?: (fraction: number) => void;
  /** Polled between rows; once true, the loop stops early (the returned grid
   *  is then meaningless — callers should discard it, e.g. via a generation
   *  counter, rather than read it). */
  isCancelled?: () => boolean;
}

/**
 * Pre-compute the ENTIRE valve grid (rows × cols) once, up front, instead of
 * sampling the video live during playback. Real video seeks are slow and
 * variable in cost — unsuitable for driving real-time playback — so once this
 * finishes, playback/preview/export all just READ this array: O(1), and
 * never touch the video again. This is what makes replay deterministic: the
 * data doesn't depend on how fast the video seeks on this run.
 *
 * Seek-reuse optimization: a row_ms (e.g. 16ms) is usually finer than the
 * video's own frame duration (e.g. 33ms @ 30fps), so consecutive rows often
 * land on the SAME decoded video frame. Detect that by bucketing each row's
 * time into an assumed video-frame index and only re-seeking when the bucket
 * changes — cuts seek count from `rows` down to roughly the number of
 * distinct video frames spanned.
 *
 * Impure only via the injected `frameAt`; a failed read (e.g. a seek timeout)
 * costs just that one bucket's row(s), not the whole compute.
 */
export async function computeFullGrid(p: ComputeFullGridParams): Promise<Uint8Array> {
  const { frameAt, cols, rows, row_ms, threshold, paint, onProgress, isCancelled } = p;
  const edge_margin = Math.max(0, Math.floor(p.edge_margin ?? 0));
  const video_fps = p.video_fps && p.video_fps > 0 ? p.video_fps : ASSUMED_VIDEO_FPS;
  const ms_per_video_frame = 1000 / video_fps;

  const grid = new Uint8Array(cols * rows);
  let lastVideoFrameIdx = -1;
  let lastRow: Uint8Array | null = null;

  for (let r = 0; r < rows; r++) {
    if (isCancelled?.()) break;

    const t_ms = r * row_ms;
    const videoFrameIdx = Math.floor(t_ms / ms_per_video_frame);
    if (videoFrameIdx !== lastVideoFrameIdx || !lastRow) {
      let img: FrameLike | null;
      try {
        img = await frameAt(t_ms);
      } catch {
        img = null; // one bad seek costs one row, not the whole precompute
      }
      lastRow = frameToValveRow(img, cols, edge_margin, threshold);
      lastVideoFrameIdx = videoFrameIdx;
    }
    grid.set(lastRow, r * cols);

    if (onProgress && (r % 4 === 0 || r === rows - 1)) onProgress((r + 1) / rows);
  }

  const painted = paint ? applyPaint(grid, paint) : grid;
  return maskEdges(painted, cols, rows, edge_margin);
}
