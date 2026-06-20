import { frameToValveRow, type FrameLike } from '../../core/layers/valve';

// DOM drawing for the valve editor. The video is drawn COMPRESSED into the
// active band [margin, cols-margin) — exactly how it is sampled into valves —
// so what you see equals what the firmware receives. Edge-margin regions are a
// disabled dark band. Below is the physical valve strip.
const STRIP_H = 30;

export function drawValveEditor(
  canvas: HTMLCanvasElement,
  img: FrameLike | null,
  cols: number,
  threshold: number,
  invert: boolean,
  paint: Record<number, boolean>,
  currentRow: number,
  edge_margin: number,
  y_frac = 0,
  flip_h = false,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || cols <= 0) return;
  const W = canvas.width;
  const H = canvas.height;
  const frameH = H - STRIP_H;
  const margin = Math.max(0, Math.floor(edge_margin));
  const active = Math.max(0, cols - 2 * margin);
  const cellW = W / cols;
  const bandX0 = margin * cellW;
  const bandW = active * cellW;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, W, H);

  // Disabled edge bands (the parts that are NOT driven — water splash zone).
  ctx.fillStyle = '#15191f';
  ctx.fillRect(0, 0, bandX0, frameH);
  ctx.fillRect(bandX0 + bandW, 0, W - (bandX0 + bandW), frameH);

  if (img && img.width > 0 && img.height > 0 && active > 0) {
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
    // Full video squeezed into the active band (matches the sampling).
    ctx.drawImage(tmp, bandX0, 0, bandW, frameH);
    // The scanline THIS row actually reads (not the whole frame averaged).
    const lineY = Math.min(frameH - 1, Math.max(0, y_frac * frameH));
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bandX0, lineY);
    ctx.lineTo(bandX0 + bandW, lineY);
    ctx.stroke();
  } else if (active > 0) {
    ctx.fillStyle = '#5a6573';
    ctx.font = '12px system-ui';
    ctx.fillText('no source — load a video', bandX0 + 8, frameH / 2);
  }

  // Valve states for the current row (the exported result).
  const rowBool = frameToValveRow(img, cols, margin, threshold, invert, y_frac, flip_h);
  for (let c = 0; c < cols; c++) {
    const isEdge = c < margin || c >= cols - margin;
    const idx = currentRow * cols + c;
    const painted = !isEdge && idx in paint;
    const on = isEdge ? false : painted ? paint[idx] : rowBool[c] === 1;
    const x = c * cellW;

    // Physical valve strip cell — the ONLY indicator of a cell's state.
    // (Earlier this also tinted the full video-frame height per "on" column,
    // which made a single-cell paint look like it had painted the whole
    // column. Paint only ever affects (currentRow, col); the strip below is
    // the single source of truth for what's actually on at this row.)
    ctx.fillStyle = isEdge ? '#15191f' : on ? '#3cc8ff' : '#222933';
    ctx.fillRect(x, frameH, Math.max(1, cellW > 3 ? cellW - 1 : cellW), STRIP_H);
    if (painted) {
      ctx.fillStyle = on ? '#ffd166' : '#ff6b6b';
      ctx.fillRect(x, frameH, Math.max(1, cellW), 3);
    }
  }

  // Active-band boundary markers (full height — video edges align with these).
  if (margin > 0) {
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 1;
    for (const bx of [bandX0, bandX0 + bandW]) {
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx, H);
      ctx.stroke();
    }
  }
}
