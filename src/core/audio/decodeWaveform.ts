// Thin Web Audio glue: fetches a media URL (blob: or remote) and decodes it
// to PCM once, for waveform visualization only — this is a one-shot
// pre-compute, never run per-frame. The actual amplitude bucketing is pure
// (computeWaveformPeaks) and unit-tested without any of this.
import { computeWaveformPeaks } from './waveform';

export interface WaveformResult {
  peaks: Uint8Array;
  durationMs: number;
}

/** The slice of ElectronAPI this needs — narrow enough to inject a fake in
 *  tests without a `window`/Electron runtime. */
export interface FileBinaryReader {
  readFileBinary(pathOrFileUrl: string): Promise<Uint8Array>;
}

function defaultFileReader(): FileBinaryReader | undefined {
  return typeof window !== 'undefined' ? window.electronAPI : undefined;
}

/** blob: (and http(s):) URLs are fetch()-able directly. file:// URLs — from a
 *  reopened project, see core/sources/VideoSource.fromPath — are NOT:
 *  Chromium blocks a renderer from fetch()ing the file: scheme regardless of
 *  the page's own origin, even for unrelated files. Read those bytes over
 *  IPC instead (the same channel project save/load already uses for files). */
export async function readAsArrayBuffer(
  url: string,
  fileReader: FileBinaryReader | undefined = defaultFileReader(),
): Promise<ArrayBuffer> {
  if (url.startsWith('file://') && fileReader) {
    const bytes = await fileReader.readFileBinary(url);
    // Electron IPC always hands back a plain ArrayBuffer-backed Uint8Array
    // (never SharedArrayBuffer) — the cast just narrows TS's ArrayBufferLike.
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }
  const res = await fetch(url);
  return res.arrayBuffer();
}

export async function decodeWaveform(url: string, numBuckets: number): Promise<WaveformResult> {
  const arrayBuffer = await readAsArrayBuffer(url);
  const ctx = new AudioContext();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const peaks = computeWaveformPeaks(audioBuffer.getChannelData(0), numBuckets);
    return { peaks, durationMs: audioBuffer.duration * 1000 };
  } finally {
    void ctx.close();
  }
}
