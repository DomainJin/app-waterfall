import type { RGB } from '../../core/layers/led';

// Renders the live RGB strip as a single row of colored cells — what the
// LED strip would actually show, downsampled to led_cols.
export function drawLedStrip(canvas: HTMLCanvasElement, strip: RGB[] | null, cols: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || cols <= 0) return;
  const W = canvas.width;
  const H = canvas.height;
  const cellW = W / cols;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, W, H);

  if (!strip || strip.length < cols) {
    ctx.fillStyle = '#5a6573';
    ctx.font = '12px system-ui';
    ctx.fillText('no source — load a video', 8, H / 2);
    return;
  }

  for (let c = 0; c < cols; c++) {
    const cell = strip[c];
    ctx.fillStyle = `rgb(${cell.r}, ${cell.g}, ${cell.b})`;
    ctx.fillRect(c * cellW, 0, Math.max(1, cellW - 1), H);
  }
}
