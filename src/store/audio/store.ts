import { create } from 'zustand';

const MAX_OFFSET_MS = 5000;

interface AudioState {
  /** Shift audio relative to the master timeline, ms. Positive = audio
   *  plays later than the timeline; negative = earlier. */
  offsetMs: number;
  volume: number; // 0..1

  // Waveform pre-computed once per bound source (see
  // useAudioWaveformCompute) — the editor just reads it, never decodes
  // per-frame.
  waveform: Uint8Array | null;
  waveformDurationMs: number;

  /** Whether the bound source has a playable audio track, detected by the
   *  playback <audio> element itself (see AudioPlayer) — independent of
   *  whether decodeAudioData can decode it for the waveform. null = no
   *  source bound, or metadata not loaded yet. */
  hasAudioTrack: boolean | null;

  setOffsetMs: (ms: number) => void;
  setVolume: (v: number) => void;
  setWaveform: (waveform: Uint8Array | null, durationMs: number) => void;
  setHasAudioTrack: (hasAudio: boolean | null) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  offsetMs: 0,
  volume: 1,
  waveform: null,
  waveformDurationMs: 0,
  hasAudioTrack: null,

  setOffsetMs: (ms) =>
    set({
      offsetMs: Number.isFinite(ms) ? Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, Math.round(ms))) : 0,
    }),
  setVolume: (v) => set({ volume: Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1 }),
  setWaveform: (waveform, durationMs) => set({ waveform, waveformDurationMs: Math.max(0, durationMs) }),
  setHasAudioTrack: (hasAudio) => set({ hasAudioTrack: hasAudio }),
}));

export { MAX_OFFSET_MS };
