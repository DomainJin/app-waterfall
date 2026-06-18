// Area-average sampling of a frame into a cols × rows intensity grid.
// PURE — works on any { data, width, height } (ImageData satisfies it), so it
// is unit-testable without the DOM.

export interface FrameLike {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/** Rec. 601 luma. */
function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Sample `img` into `cols × rows` cells, each the area-average luminance of
 * the pixels it covers, normalized to 0..1. Returned flat, index = r*cols + c.
 */
export function sampleFrameToGrid(
  img: FrameLike,
  cols: number,
  rows: number,
): Float32Array {
  const { data, width, height } = img;
  const out = new Float32Array(cols * rows);
  if (cols <= 0 || rows <= 0 || width <= 0 || height <= 0) return out;

  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor((r * height) / rows);
    const y1 = Math.min(height, Math.max(y0 + 1, Math.floor(((r + 1) * height) / rows)));
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor((c * width) / cols);
      const x1 = Math.min(width, Math.max(x0 + 1, Math.floor(((c + 1) * width) / cols)));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        let i = (y * width + x0) * 4;
        for (let x = x0; x < x1; x++) {
          sum += luma(data[i], data[i + 1], data[i + 2]);
          i += 4;
          count++;
        }
      }
      out[r * cols + c] = count ? sum / count / 255 : 0;
    }
  }
  return out;
}
