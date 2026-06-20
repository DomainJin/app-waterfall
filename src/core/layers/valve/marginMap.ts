import { sampleScanline, type FrameLike } from './sample';
import { thresholdGrid } from './threshold';

// edge_margin: app-side symmetric margin. Edge valves never open (water near
// the curtain edge splashes out); the video is compressed 100% into the active
// middle band. valve_cols and the .bin are unchanged. PURE.

/** active_cols = valve_cols − 2 × edge_margin (clamped ≥ 0). */
export function activeCols(cols: number, edge_margin: number): number {
  return Math.max(0, cols - 2 * Math.max(0, Math.floor(edge_margin)));
}

/**
 * Map a frame to a full cols-length boolean valve row. The whole video width is
 * compressed 100% into the active band [margin, cols − margin); edge valves are
 * forced off and never sample the video.
 *
 * Column mapping: an ACTIVE valve v samples the video at normalized column
 * u = (v − margin) / active_cols  ∈ [0, 1) — NOT u = v / cols. So valve
 * `margin` reads the video's left edge (u≈0) and valve `cols−margin−1` reads the
 * right edge (u≈1); no edge pixels are dropped onto the off edge-valves.
 *
 * Row mapping (the waterfall is an inkjet, not a camera): a valve row reads
 * ONE horizontal scanline of the frame at normalized height `y_frac`, NOT an
 * average over the whole frame height — averaging the full height would make
 * every row identical regardless of `y_frac`, erasing all vertical/temporal
 * texture. `y_frac` is the caller's job to vary per row (see computeFullGrid),
 * including reversing it for a vertical flip — this function only does the
 * horizontal flip, since that's purely a column re-ordering of one row.
 *
 * `flip_h` re-orders the ACTIVE columns after sampling + thresholding: active
 * valve k (k = v − margin) reads bits[active − 1 − k] instead of bits[k] — a
 * mirror within the active band, edge valves untouched (still off).
 */
export function frameToValveRow(
  img: FrameLike | null,
  cols: number,
  edge_margin: number,
  threshold: number,
  invert = false,
  y_frac = 0,
  flip_h = false,
): Uint8Array {
  const out = new Uint8Array(cols);
  const margin = Math.max(0, Math.floor(edge_margin));
  const active = activeCols(cols, margin);
  if (active <= 0 || !img) return out; // invalid margin or no source -> all off
  const band = sampleScanline(img, active, y_frac); // one scanline -> active bins
  const bits = thresholdGrid(band, threshold, invert);
  for (let v = margin; v < cols - margin; v++) {
    // u = (v - margin) / active  (band index v - margin)
    const k = v - margin;
    out[v] = bits[flip_h ? active - 1 - k : k];
  }
  return out;
}

/** Force edge columns ([0,margin) and [cols−margin,cols)) off across all rows. */
export function maskEdges(
  bool: Uint8Array,
  cols: number,
  rows: number,
  edge_margin: number,
): Uint8Array {
  const margin = Math.max(0, Math.floor(edge_margin));
  if (margin <= 0) return bool;
  const out = bool.slice();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < margin || c >= cols - margin) out[r * cols + c] = 0;
    }
  }
  return out;
}
