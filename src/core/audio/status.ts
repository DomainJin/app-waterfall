// Pure: tri-state UI status for the audio layer. PURE / DOM-free.
export type AudioStatus = 'ok' | 'unsupported' | 'none';

/** Combines "does the source have a playable audio track" (detected via the
 *  playback <audio> element itself — see AudioPlayer.detectHasAudioTrack,
 *  independent of decodeAudioData) with "did the waveform actually decode"
 *  (a separate, more codec-fragile path used only for visualization).
 *  Playback never depends on the waveform decode succeeding — a codec
 *  decodeAudioData rejects can still play fine through the same element
 *  <video> uses, so "unsupported" still means audio plays, just unvisualized. */
export function audioStatus(hasAudioTrack: boolean | null, waveformDurationMs: number): AudioStatus {
  if (waveformDurationMs > 0) return 'ok';
  return hasAudioTrack ? 'unsupported' : 'none';
}
