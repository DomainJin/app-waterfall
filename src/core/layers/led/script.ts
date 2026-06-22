// LED script pre-compute (LED_MODE_SPEC.md) — the LED strip reacts to the
// VALVE GRID, not the source video. LED i's "cluster" is valve columns
// [i*ratio, (i+1)*ratio) (ratio = gridCols/ledCols, nominally 4 since 40
// valves/m vs 10 LEDs/m). Computed ONCE for the whole timeline right after
// the valve grid, same shape (flat, row-major) so play/preview/export can
// index it exactly like the valve grid — no real-time computation. PURE.

import { applyBrightnessGamma, BLACK, type RGB } from './colors';

export type LedMode = 'normal' | 'focus' | 'fade' | 'mix';

export interface LedScriptOptions {
  mode: LedMode;
  baseColor: RGB;
  /** FADE: ~rows to close most of the gap on an on/off edge (1-20). */
  fadeSpeed: number;
  /** MIX_COLOR: palette to cycle through on each pattern edge. */
  palette: readonly RGB[];
  brightness: number;
  gamma: number;
}

/**
 * Pre-compute the entire LED script from the (already pre-computed) valve
 * grid. Output is a flat row-major Uint8Array, 3 bytes (R,G,B) per cell —
 * `gridRows * ledCols * 3` long, same row indexing as the valve grid.
 */
export function computeLedScript(
  valveGrid: Uint8Array,
  gridRows: number,
  gridCols: number,
  ledCols: number,
  opts: LedScriptOptions,
): Uint8Array {
  const out = new Uint8Array(Math.max(0, gridRows) * Math.max(0, ledCols) * 3);
  if (gridRows <= 0 || gridCols <= 0 || ledCols <= 0) return out;

  const { mode, baseColor, fadeSpeed, palette, brightness, gamma } = opts;
  const pal = palette.length > 0 ? palette : [baseColor];
  // Exponential approach to the target each row; after ~fadeSpeed rows most
  // of the gap is closed. fadeSpeed is "rows to complete transition" (1-20).
  const fadeFactor = fadeSpeed > 0 ? Math.min(1, 1 / fadeSpeed) : 1;
  const ratio = gridCols / ledCols;

  for (let i = 0; i < ledCols; i++) {
    const v0 = Math.floor(i * ratio);
    const v1 = Math.min(gridCols, Math.max(v0 + 1, Math.floor((i + 1) * ratio)));

    let prevOn = false;
    let faded: RGB = BLACK;
    let mixColor: RGB = pal[0];
    let paletteIdx = -1;

    for (let r = 0; r < gridRows; r++) {
      const rowBase = r * gridCols;
      let on = false;
      for (let v = v0; v < v1; v++) {
        if (valveGrid[rowBase + v] === 1) {
          on = true;
          break;
        }
      }

      let cell: RGB;
      switch (mode) {
        case 'normal':
          cell = baseColor;
          break;
        case 'focus':
          cell = on ? baseColor : BLACK;
          break;
        case 'fade': {
          const target = on ? baseColor : BLACK;
          faded = {
            r: faded.r + (target.r - faded.r) * fadeFactor,
            g: faded.g + (target.g - faded.g) * fadeFactor,
            b: faded.b + (target.b - faded.b) * fadeFactor,
          };
          cell = faded;
          break;
        }
        case 'mix':
        default: {
          if (on && !prevOn) {
            paletteIdx = (paletteIdx + 1) % pal.length;
            mixColor = pal[paletteIdx];
          }
          cell = on ? mixColor : BLACK;
          break;
        }
      }
      prevOn = on;

      const c = applyBrightnessGamma(cell, brightness, gamma);
      const outBase = (r * ledCols + i) * 3;
      out[outBase] = c.r;
      out[outBase + 1] = c.g;
      out[outBase + 2] = c.b;
    }
  }
  return out;
}

/** Read one row out of a flat ledScript (see computeLedScript) as RGB[] —
 *  used for live device streaming and the LED editor's single-row preview. */
export function readLedScriptRow(script: Uint8Array, row: number, cols: number): RGB[] {
  const out: RGB[] = new Array(Math.max(0, cols));
  const base = row * cols * 3;
  for (let i = 0; i < out.length; i++) {
    out[i] = { r: script[base + i * 3], g: script[base + i * 3 + 1], b: script[base + i * 3 + 2] };
  }
  return out;
}
