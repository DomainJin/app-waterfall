// Downsamples decoded PCM channel data into a fixed number of amplitude
// buckets (0..255) for waveform rendering. Pure/DOM-free — testable without
// decoding real audio (see decodeWaveform.ts for the Web Audio glue).
export function computeWaveformPeaks(channelData: Float32Array, numBuckets: number): Uint8Array {
  const count = Math.max(0, Math.floor(numBuckets));
  const out = new Uint8Array(count);
  const n = channelData.length;
  if (n === 0 || count === 0) return out;

  const bucketSize = n / count;
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucketSize));
    let peak = 0;
    for (let j = start; j < end && j < n; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > peak) peak = abs;
    }
    out[i] = Math.round(Math.min(1, peak) * 255);
  }
  return out;
}
