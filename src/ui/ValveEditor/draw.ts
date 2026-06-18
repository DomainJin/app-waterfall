import { sampleFrameToGrid, type FrameLike } from '../../core/layers/valve';

// DOM drawing for the valve editor: source frame + per-column valve states
// (threshold result, with manual paint overlaid) for the current time row.
const STRIP_H = 30;

export function drawValveEditor(
  canvas: HTMLCanvasElement,
  img: FrameLike | null,
  cols: number,
  threshold: number,
  paint: Record<number, boolean>,
  currentRow: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || cols <= 0) return;
  const W = canvas.width;
  const H = canvas.height;
  const frameH = H - STRIP_H;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, W, H);

  if (img && img.width > 0 && img.height > 0) {
    const tmp = document.createElement('canvas');
    tmp.width = img.width;
    tmp.height = img.height;
    tmp
      .getContext('2d')!
      .putImageData(
        new ImageData(new Uint8ClampedArray(img.data), img.width, img.height),
        0,
        0,
      );
    ctx.drawImage(tmp, 0, 0, W, frameH);
  } else {
    ctx.fillStyle = '#1a1f27';
    ctx.fillRect(0, 0, W, frameH);
    ctx.fillStyle = '#5a6573';
    ctx.font = '12px system-ui';
    ctx.fillText('no source — load a video', 10, frameH / 2);
  }

  const intensity = img ? sampleFrameToGrid(img, cols, 1) : new Float32Array(cols);
  const cellW = W / cols;
  for (let c = 0; c < cols; c++) {
    const idx = currentRow * cols + c;
    const painted = idx in paint;
    const on = painted ? paint[idx] : intensity[c] >= threshold;
    const x = c * cellW;

    if (on) {
      ctx.fillStyle = 'rgba(60, 200, 255, 0.28)';
      ctx.fillRect(x, 0, Math.max(1, cellW), frameH);
    }
    ctx.fillStyle = on ? '#3cc8ff' : '#222933';
    ctx.fillRect(x, frameH, Math.max(1, cellW > 3 ? cellW - 1 : cellW), STRIP_H);
    if (painted) {
      ctx.fillStyle = on ? '#ffd166' : '#ff6b6b';
      ctx.fillRect(x, frameH, Math.max(1, cellW), 3);
    }
  }
}
