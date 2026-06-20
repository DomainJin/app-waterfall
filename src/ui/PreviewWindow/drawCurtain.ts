import { fallY, visibleRowRange } from '../../core/preview';

// Canvas render for the preview curtain. Falling-water streaks for active
// valves, a meter ruler, the ms readout, and the disabled edge-margin bands.
// Pure DOM drawing driven by a plain state object (no React).
//
// `grid` is the ENTIRE precomputed valve grid (see computeFullGrid), pushed
// once per recompute — not a row-by-row stream. Rendering just indexes into
// it directly, so it can never be "missing" a row mid-playback the way a
// live/streamed cache could.

export interface CurtainState {
  grid: Uint8Array | null;
  rows: number;
  cols: number;
  row_ms: number;
  margin: number;
  length_m: number;
  positionMs: number;
  durationMs: number;
  fall_time_ms: number;
  // LED matrix only ever shows the CURRENT instant (no falling/history) —
  // flat row-major R,G,B per cell, length = ledRows*ledCols*3.
  ledRgb: Uint8Array | null;
  ledRows: number;
  ledCols: number;
}

const RULER_H = 30;
const LED_STRIP_H = 36;

export function drawCurtain(
  canvas: HTMLCanvasElement,
  s: CurtainState,
  valveOn: boolean,
  ledOn: boolean,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const showLedStrip = ledOn && s.ledCols > 0 && s.ledRows > 0 && !!s.ledRgb;
  const curtainTop = RULER_H + (showLedStrip ? LED_STRIP_H : 0);
  const curtainH = H - curtainTop;
  const cols = s.cols || 0;
  const colW = cols > 0 ? W / cols : W;
  const margin = s.margin || 0;
  const bandX0 = margin * colW;
  const bandX1 = (cols - margin) * colW;

  // Background + curtain panel.
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0e141b';
  ctx.fillRect(0, curtainTop, W, curtainH);

  // Disabled edge bands (not driven — water splash zone).
  if (margin > 0 && cols > 0) {
    ctx.fillStyle = 'rgba(255, 107, 107, 0.06)';
    ctx.fillRect(0, curtainTop, bandX0, curtainH);
    ctx.fillRect(bandX1, curtainTop, W - bandX1, curtainH);
  }

  // Falling water — a waterfall is a vertical printer: each row is a thin
  // horizontal band of droplets released at t = r*row_ms, then falling under
  // gravity (y(dt) quadratic in age, via fallY). Drawing each row at its OWN
  // fall position — and nothing else — is what makes the video's horizontal
  // texture (a heart, text, a wave) show up at all: a continuous streak per
  // valve (as if water always traced one solid column) would smear distinct
  // rows together and erase exactly that texture.
  if (valveOn && cols > 0 && s.row_ms > 0 && s.grid) {
    const { r0, r1 } = visibleRowRange(s.positionMs, s.row_ms, s.rows, s.fall_time_ms);
    const cellH = Math.max(2, curtainH * 0.012);
    const w = Math.max(1, colW * 0.85);
    for (let r = r1; r >= r0; r--) {
      const age = s.positionMs - r * s.row_ms;
      if (age < 0 || age > s.fall_time_ms) continue;
      const base = r * cols;
      const y = curtainTop + fallY(age, curtainH, s.fall_time_ms);
      const fade = 1 - age / s.fall_time_ms;
      ctx.fillStyle = `rgba(170, 220, 255, ${(0.35 + 0.55 * fade).toFixed(3)})`;
      for (let v = margin; v < cols - margin; v++) {
        if (s.grid[base + v] !== 1) continue;
        ctx.fillRect(v * colW, y - cellH / 2, w, cellH);
      }
    }
  }

  // LED matrix strip — mounted above the curtain. Unlike the falling water
  // (which stacks many past rows at once), the LED layer only ever shows the
  // CURRENT instant, so this is a plain downsampled-color render, no aging.
  if (showLedStrip && s.ledRgb) {
    const stripTop = RULER_H;
    const cellW = W / s.ledCols;
    const cellH = LED_STRIP_H / s.ledRows;
    for (let r = 0; r < s.ledRows; r++) {
      for (let c = 0; c < s.ledCols; c++) {
        const i = (r * s.ledCols + c) * 3;
        ctx.fillStyle = `rgb(${s.ledRgb[i]}, ${s.ledRgb[i + 1]}, ${s.ledRgb[i + 2]})`;
        ctx.fillRect(c * cellW, stripTop + r * cellH, Math.max(1, cellW - 1), Math.max(1, cellH - 1));
      }
    }
  }

  // Ruler (top).
  ctx.fillStyle = '#13181f';
  ctx.fillRect(0, 0, W, RULER_H);
  ctx.strokeStyle = '#2a2f37';
  ctx.beginPath();
  ctx.moveTo(0, RULER_H - 0.5);
  ctx.lineTo(W, RULER_H - 0.5);
  ctx.stroke();

  const Lm = s.length_m || 0;
  if (Lm > 0) {
    const meters = Math.ceil(Lm);
    const labelEvery = meters > 15 ? 5 : 1;
    ctx.fillStyle = '#8a93a0';
    ctx.font = '10px system-ui';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    for (let m = 0; m <= meters; m++) {
      const x = (m / Lm) * W;
      if (x > W) break;
      ctx.strokeStyle = '#3a414c';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, m % labelEvery === 0 ? RULER_H : RULER_H * 0.5);
      ctx.stroke();
      if (m % labelEvery === 0) ctx.fillText(`${m}m`, Math.min(x + 2, W - 16), RULER_H - 9);
    }
  }

  // Active-band boundary markers (full height).
  if (margin > 0 && cols > 0) {
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 1;
    for (const bx of [bandX0, bandX1]) {
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx, H);
      ctx.stroke();
    }
  }

  // ms readout (top-right).
  ctx.fillStyle = '#5ce1a6';
  ctx.font = '12px system-ui';
  ctx.textAlign = 'right';
  ctx.fillText(`t = ${Math.round(s.positionMs)} ms`, W - 8, 20);
  ctx.textAlign = 'left';

  // Status hints.
  if (cols === 0) {
    ctx.fillStyle = '#5a6573';
    ctx.font = '12px system-ui';
    ctx.fillText('waiting for data from main window…', 10, curtainTop + 24);
  } else if (!valveOn) {
    ctx.fillStyle = '#5a6573';
    ctx.font = '12px system-ui';
    ctx.fillText('valve layer hidden', 10, curtainTop + 24);
  }
}
