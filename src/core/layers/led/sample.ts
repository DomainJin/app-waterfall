// LED layer: downsample a video frame into an led_rows x led_cols RGB
// matrix (area-average per cell, same pattern as the valve's
// sampleFrameToGrid — just RGB instead of luma) and apply brightness/gamma.
// PURE — works on any { data, width, height } (ImageData satisfies it).

import type { FrameLike } from '../valve';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Area-average each cell's R, G, B independently. Flat, index = r*cols + c. */
export function sampleFrameToRgbGrid(img: FrameLike, cols: number, rows: number): RGB[] {
  const { data, width, height } = img;
  const out: RGB[] = new Array(cols * rows);
  if (cols <= 0 || rows <= 0 || width <= 0 || height <= 0) {
    for (let i = 0; i < out.length; i++) out[i] = { r: 0, g: 0, b: 0 };
    return out;
  }

  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor((r * height) / rows);
    const y1 = Math.min(height, Math.max(y0 + 1, Math.floor(((r + 1) * height) / rows)));
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor((c * width) / cols);
      const x1 = Math.min(width, Math.max(x0 + 1, Math.floor(((c + 1) * width) / cols)));
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        let i = (y * width + x0) * 4;
        for (let x = x0; x < x1; x++) {
          sr += data[i];
          sg += data[i + 1];
          sb += data[i + 2];
          i += 4;
          count++;
        }
      }
      out[r * cols + c] = count
        ? { r: sr / count, g: sg / count, b: sb / count }
        : { r: 0, g: 0, b: 0 };
    }
  }
  return out;
}

/**
 * Brightness (0-255, 255 = identity multiplier) and gamma (1 = identity,
 * >1 darkens midtones, <1 brightens them) correction, applied per channel.
 */
export function applyBrightnessGamma(c: RGB, brightness: number, gamma: number): RGB {
  const scale = Math.max(0, brightness) / 255;
  const g = gamma > 0 ? gamma : 1;
  const adjust = (v: number) => {
    const normalized = Math.max(0, Math.min(1, v / 255));
    return Math.max(0, Math.min(255, Math.round(255 * Math.pow(normalized, g) * scale)));
  };
  return { r: adjust(c.r), g: adjust(c.g), b: adjust(c.b) };
}

/** Flatten an RGB[] matrix into a row-major Uint8Array (R,G,B per cell) — the
 *  wire shape used for the preview IPC message and the codec's pixel packers. */
export function flattenRgb(matrix: RGB[]): Uint8Array {
  const out = new Uint8Array(matrix.length * 3);
  for (let i = 0; i < matrix.length; i++) {
    out[i * 3] = matrix[i].r;
    out[i * 3 + 1] = matrix[i].g;
    out[i * 3 + 2] = matrix[i].b;
  }
  return out;
}

/**
 * Sample one LED frame: downsample `img` into `cols x rows`, then apply
 * brightness/gamma. `img == null` (no source yet) -> an all-black matrix of
 * the right size, so callers can always render/send a well-formed grid.
 */
export function sampleLedMatrix(
  img: FrameLike | null,
  cols: number,
  rows: number,
  brightness = 255,
  gamma = 1,
): RGB[] {
  if (!img || cols <= 0 || rows <= 0) {
    return new Array(Math.max(0, cols * rows)).fill(null).map(() => ({ r: 0, g: 0, b: 0 }));
  }
  const raw = sampleFrameToRgbGrid(img, cols, rows);
  return raw.map((c) => applyBrightnessGamma(c, brightness, gamma));
}
