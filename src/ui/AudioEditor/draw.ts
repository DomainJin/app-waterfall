import type { AudioStatus } from '../../core/audio';

// Pure drawing — peaks pre-computed once by useAudioWaveformCompute; this
// just rasterizes the current array + playhead, no decoding here. `status`
// distinguishes "no audio source at all" from "has audio but this codec's
// waveform couldn't be decoded" (audio still plays either way in the latter
// case — see core/audio/AudioPlayer.ts).
export function drawWaveform(
  canvas: HTMLCanvasElement,
  waveform: Uint8Array | null,
  durationMs: number,
  playheadSec: number,
  status: AudioStatus,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const mid = H / 2;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, W, H);

  if (status !== 'ok' || !waveform || waveform.length === 0 || durationMs <= 0) {
    ctx.fillStyle = '#5a6573';
    ctx.font = '12px system-ui';
    const msg =
      status === 'unsupported'
        ? 'waveform unavailable — unsupported codec (audio still plays)'
        : 'no audio — load a video/audio file';
    ctx.fillText(msg, 8, mid);
    return;
  }

  const barW = W / waveform.length;
  ctx.fillStyle = '#3a86ff';
  for (let i = 0; i < waveform.length; i++) {
    const amp = (waveform[i] / 255) * mid;
    ctx.fillRect(i * barW, mid - amp, Math.max(1, barW - 0.5), Math.max(1, amp * 2));
  }

  const x = ((playheadSec * 1000) / durationMs) * W;
  if (x >= 0 && x <= W) {
    ctx.strokeStyle = '#ff5d5d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
}
