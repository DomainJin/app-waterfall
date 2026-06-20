import type { RGB } from '../../core/layers/led';

// Renders the live RGB matrix as a grid of colored cells — what the LED
// strip would actually show, downsampled to led_cols x led_rows.
export function drawLedMatrix(
  canvas: HTMLCanvasElement,
  matrix: RGB[] | null,
  cols: number,
  rows: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || cols <= 0 || rows <= 0) return;
  const W = canvas.width;
  const H = canvas.height;
  const cellW = W / cols;
  const cellH = H / rows;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, W, H);

  if (!matrix || matrix.length < cols * rows) {
    ctx.fillStyle = '#5a6573';
    ctx.font = '12px system-ui';
    ctx.fillText('no source — load a video', 8, H / 2);
    return;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = matrix[r * cols + c];
      ctx.fillStyle = `rgb(${cell.r}, ${cell.g}, ${cell.b})`;
      ctx.fillRect(c * cellW, r * cellH, Math.max(1, cellW - 1), Math.max(1, cellH - 1));
    }
  }
}
