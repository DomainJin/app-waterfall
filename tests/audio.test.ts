import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AudioPlayer,
  audioStatus,
  computeWaveformPeaks,
  detectHasAudioTrack,
  needsResync,
  readAsArrayBuffer,
  targetAudioSec,
} from '../src/core/audio';
import type { AudioElementLike, FileBinaryReader } from '../src/core/audio';

describe('targetAudioSec', () => {
  it('converts position + offset (ms) to seconds', () => {
    expect(targetAudioSec(1000, 0)).toBeCloseTo(1, 6);
    expect(targetAudioSec(1000, 500)).toBeCloseTo(1.5, 6);
    expect(targetAudioSec(1000, -200)).toBeCloseTo(0.8, 6);
  });

  it('clamps to 0 when offset pushes target negative', () => {
    expect(targetAudioSec(100, -500)).toBe(0);
    expect(targetAudioSec(0, 0)).toBe(0);
  });

  it('treats a non-finite result as 0', () => {
    expect(targetAudioSec(NaN, 0)).toBe(0);
  });
});

describe('needsResync', () => {
  it('false within tolerance, true beyond it', () => {
    expect(needsResync(1.0, 1.1, 0.15)).toBe(false);
    expect(needsResync(1.0, 1.2, 0.15)).toBe(true);
  });

  it('defaults to a 0.15s tolerance', () => {
    expect(needsResync(1.0, 1.1)).toBe(false);
    expect(needsResync(1.0, 1.2)).toBe(true);
  });

  it('symmetric in either drift direction', () => {
    expect(needsResync(2.0, 1.0, 0.5)).toBe(true);
    expect(needsResync(1.0, 2.0, 0.5)).toBe(true);
  });
});

describe('computeWaveformPeaks', () => {
  it('all-zero input produces all-zero buckets', () => {
    const out = computeWaveformPeaks(new Float32Array(100), 10);
    expect([...out]).toEqual(new Array(10).fill(0));
  });

  it('full-scale samples map to 255', () => {
    const data = new Float32Array(10).fill(1);
    const out = computeWaveformPeaks(data, 5);
    expect([...out]).toEqual([255, 255, 255, 255, 255]);
  });

  it('takes the peak (max abs) within each bucket, including negative samples', () => {
    const data = new Float32Array([0, -1, 0, 0.2, 0, 0, 0, 0]);
    const out = computeWaveformPeaks(data, 2);
    expect(out[0]).toBe(255); // bucket 0: [0, -1, 0, 0.2] -> peak 1
    expect(out[1]).toBe(0); // bucket 1: all zero
  });

  it('clamps out-of-range amplitude to 1.0 -> 255', () => {
    const out = computeWaveformPeaks(new Float32Array([2.5]), 1);
    expect(out[0]).toBe(255);
  });

  it('empty input -> all-zero array of the requested length', () => {
    const out = computeWaveformPeaks(new Float32Array(0), 4);
    expect([...out]).toEqual([0, 0, 0, 0]);
  });

  it('zero buckets -> empty array, no division by zero', () => {
    const out = computeWaveformPeaks(new Float32Array([1, 2, 3]), 0);
    expect(out.length).toBe(0);
  });

  it('more buckets than samples still produces a valid array (some buckets repeat samples)', () => {
    const out = computeWaveformPeaks(new Float32Array([1, 0]), 5);
    expect(out.length).toBe(5);
    expect(out.every((v) => v === 0 || v === 255)).toBe(true);
  });
});

// Fake element — duck-types just the fields AudioPlayer touches, so sync
// logic is testable without a real <audio> element / DOM. `fireLoadedMetadata`
// invokes whatever listener is currently registered, simulating the browser
// firing the event once the resource's metadata is parsed.
function fakeElement(): AudioElementLike & {
  playCalls: number;
  pauseCalls: number;
  addListenerCalls: number;
  removeListenerCalls: number;
  fireLoadedMetadata(): void;
} {
  let listener: (() => void) | null = null;
  return {
    src: '',
    currentTime: 0,
    paused: true,
    volume: 1,
    duration: 0,
    playCalls: 0,
    pauseCalls: 0,
    addListenerCalls: 0,
    removeListenerCalls: 0,
    play() {
      this.playCalls++;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.pauseCalls++;
      this.paused = true;
    },
    removeAttribute() {
      this.src = '';
    },
    addEventListener(_type, cb) {
      this.addListenerCalls++;
      listener = cb;
    },
    removeEventListener() {
      this.removeListenerCalls++;
      listener = null;
    },
    fireLoadedMetadata() {
      listener?.();
    },
  };
}

// Fake MediaStream — just enough of captureStream()'s return value for
// detectHasAudioTrack to read.
function fakeStream(audioTrackCount: number): {
  getAudioTracks(): unknown[];
  getTracks(): { stop(): void }[];
  stoppedCount: number;
} {
  const tracks = Array.from({ length: audioTrackCount }, () => ({}));
  const state = { stoppedCount: 0 };
  return {
    getAudioTracks: () => tracks,
    getTracks: () =>
      tracks.map(() => ({
        stop: () => {
          state.stoppedCount++;
        },
      })),
    get stoppedCount() {
      return state.stoppedCount;
    },
  };
}

describe('detectHasAudioTrack', () => {
  it('true when captureStream reports at least one audio track', () => {
    const el = fakeElement();
    el.captureStream = () => fakeStream(1);
    expect(detectHasAudioTrack(el)).toBe(true);
  });

  it('false when captureStream reports zero audio tracks (video-only source) — even though duration > 0', () => {
    const el = fakeElement();
    el.captureStream = () => fakeStream(0);
    el.duration = 10; // a valid video-only file still has a duration
    expect(detectHasAudioTrack(el)).toBe(false);
  });

  it('stops the captured tracks after reading (no lingering resource use)', () => {
    const el = fakeElement();
    const stream = fakeStream(1);
    el.captureStream = () => stream;
    detectHasAudioTrack(el);
    expect(stream.stoppedCount).toBe(1);
  });

  it('falls back to duration > 0 when captureStream is unimplemented', () => {
    const el = fakeElement(); // no captureStream set
    el.duration = 5;
    expect(detectHasAudioTrack(el)).toBe(true);
    el.duration = 0;
    expect(detectHasAudioTrack(el)).toBe(false);
  });
});

describe('audioStatus', () => {
  it('"ok" whenever the waveform actually decoded, regardless of hasAudioTrack', () => {
    expect(audioStatus(true, 1000)).toBe('ok');
    expect(audioStatus(null, 1000)).toBe('ok');
  });

  it('"unsupported" when there is a track but the waveform did not decode', () => {
    expect(audioStatus(true, 0)).toBe('unsupported');
  });

  it('"none" when there is no audio track', () => {
    expect(audioStatus(false, 0)).toBe('none');
  });

  it('"none" when track presence is still unknown (no source bound)', () => {
    expect(audioStatus(null, 0)).toBe('none');
  });
});

describe('readAsArrayBuffer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fakeFileReader(bytes: Uint8Array): FileBinaryReader & { calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      readFileBinary: async (pathOrFileUrl) => {
        calls.push(pathOrFileUrl);
        return bytes;
      },
    };
  }

  it('reads file:// URLs via the injected IPC reader, not fetch (fetch would throw if called)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fetch should not be called for file://'))));
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const reader = fakeFileReader(bytes);
    const buf = await readAsArrayBuffer('file:///D:/videos/song.mp4', reader);
    expect(new Uint8Array(buf)).toEqual(bytes);
    expect(reader.calls).toEqual(['file:///D:/videos/song.mp4']);
  });

  it('slices to the exact byte range (no overrun from a pooled/offset buffer)', async () => {
    const pool = new Uint8Array([9, 9, 1, 2, 3, 9, 9]);
    const view = new Uint8Array(pool.buffer, 2, 3); // offset=2, length=3 -> [1,2,3]
    const reader = fakeFileReader(view);
    const buf = await readAsArrayBuffer('file:///x.mp4', reader);
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('uses fetch() for non-file:// URLs (blob:, http:) even when a file reader is provided', async () => {
    const fakeArrayBuffer = new ArrayBuffer(8);
    const fetchMock = vi.fn(() => Promise.resolve({ arrayBuffer: () => Promise.resolve(fakeArrayBuffer) }));
    vi.stubGlobal('fetch', fetchMock);
    const reader = fakeFileReader(new Uint8Array());
    const buf = await readAsArrayBuffer('blob:fake', reader);
    expect(buf).toBe(fakeArrayBuffer);
    expect(fetchMock).toHaveBeenCalledWith('blob:fake');
    expect(reader.calls).toEqual([]);
  });

  it('falls back to fetch() for a file:// URL when no file reader is available (e.g. plain browser)', async () => {
    const fakeArrayBuffer = new ArrayBuffer(4);
    const fetchMock = vi.fn(() => Promise.resolve({ arrayBuffer: () => Promise.resolve(fakeArrayBuffer) }));
    vi.stubGlobal('fetch', fetchMock);
    const buf = await readAsArrayBuffer('file:///x.mp4', undefined);
    expect(buf).toBe(fakeArrayBuffer);
  });
});

describe('AudioPlayer', () => {
  it('sync() is a no-op when no source is set', () => {
    const el = fakeElement();
    const player = new AudioPlayer(() => el);
    player.sync(1000, true, 0);
    expect(el.playCalls).toBe(0);
  });

  it('plays when isPlaying and paused; pauses when not isPlaying', () => {
    const el = fakeElement();
    const player = new AudioPlayer(() => el);
    player.setSource('blob:fake');
    player.sync(0, true, 0);
    expect(el.playCalls).toBe(1);
    player.sync(0, false, 0);
    expect(el.pauseCalls).toBe(1);
  });

  it('seeks only when drift exceeds tolerance', () => {
    const el = fakeElement();
    const player = new AudioPlayer(() => el);
    player.setSource('blob:fake');
    player.sync(1000, false, 0); // target 1.0s, currentTime 0 -> drift, seeks
    expect(el.currentTime).toBeCloseTo(1, 6);
    el.currentTime = 1.02; // small drift within tolerance of target 1.05
    player.sync(1050, false, 0);
    expect(el.currentTime).toBeCloseTo(1.02, 6); // untouched
  });

  it('applies the offset when computing the seek target', () => {
    const el = fakeElement();
    const player = new AudioPlayer(() => el);
    player.setSource('blob:fake');
    player.sync(1000, false, 500); // (1000+500)/1000 = 1.5s
    expect(el.currentTime).toBeCloseTo(1.5, 6);
  });

  it('setSource(null) pauses and clears src', () => {
    const el = fakeElement();
    const player = new AudioPlayer(() => el);
    player.setSource('blob:fake');
    player.sync(0, true, 0);
    expect(player.hasSource).toBe(true);
    player.setSource(null);
    expect(player.hasSource).toBe(false);
    expect(el.pauseCalls).toBeGreaterThan(0);
  });

  it('setSource with the same url is a no-op (does not re-touch src)', () => {
    const el = fakeElement();
    const player = new AudioPlayer(() => el);
    player.setSource('blob:fake');
    el.src = 'blob:fake';
    player.setSource('blob:fake');
    expect(el.src).toBe('blob:fake');
  });

  it('setVolume clamps to [0, 1]', () => {
    const el = fakeElement();
    const player = new AudioPlayer(() => el);
    player.setVolume(1.5);
    expect(el.volume).toBe(1);
    player.setVolume(-1);
    expect(el.volume).toBe(0);
  });

  it('dispose pauses and clears src', () => {
    const el = fakeElement();
    const player = new AudioPlayer(() => el);
    player.setSource('blob:fake');
    player.dispose();
    expect(el.pauseCalls).toBeGreaterThan(0);
    expect(el.src).toBe('');
  });

  it('reports hasAudio=null (pending) immediately on setSource, then the real answer once metadata loads', () => {
    const el = fakeElement();
    const calls: (boolean | null)[] = [];
    const player = new AudioPlayer(() => el, (v) => calls.push(v));
    player.setSource('blob:fake');
    expect(calls).toEqual([null]); // pending — no answer yet
    el.captureStream = () => fakeStream(1);
    el.fireLoadedMetadata();
    expect(calls).toEqual([null, true]);
  });

  it('reports hasAudio=false for a video-only source (no audio track)', () => {
    const el = fakeElement();
    const calls: (boolean | null)[] = [];
    const player = new AudioPlayer(() => el, (v) => calls.push(v));
    player.setSource('blob:fake');
    el.captureStream = () => fakeStream(0);
    el.fireLoadedMetadata();
    expect(calls).toEqual([null, false]);
  });

  it('setSource(null) reports hasAudio=null and does not leave a stale answer', () => {
    const el = fakeElement();
    const calls: (boolean | null)[] = [];
    const player = new AudioPlayer(() => el, (v) => calls.push(v));
    player.setSource('blob:fake');
    el.captureStream = () => fakeStream(1);
    el.fireLoadedMetadata();
    player.setSource(null);
    expect(calls).toEqual([null, true, null]);
  });

  it('switching sources detaches the old metadata listener before attaching the new one', () => {
    const el = fakeElement();
    const calls: (boolean | null)[] = [];
    const player = new AudioPlayer(() => el, (v) => calls.push(v));
    player.setSource('blob:fake-1');
    expect(el.addListenerCalls).toBe(1);
    player.setSource('blob:fake-2'); // switch before the first ever resolves
    expect(el.removeListenerCalls).toBe(1); // old listener detached
    expect(el.addListenerCalls).toBe(2); // new one attached
    el.captureStream = () => fakeStream(1);
    el.fireLoadedMetadata();
    // Only ONE 'true' from the fire — proves there's exactly one live listener.
    expect(calls).toEqual([null, null, true]);
  });
});
