// Drives a dedicated <audio> element in sync with the master clock. This is
// intentionally NOT the muted <video> element VideoSource uses for frame
// extraction (src/core/sources/VideoSource.ts) — that element gets seeked
// rapidly during valve/LED grid precompute, which would make audio playback
// stutter/glitch if it were also the thing producing sound. Keeping a
// separate element means precompute seeks never touch what the user hears.
//
// Playback NEVER goes through decodeAudioData — only this element's own
// hardware-backed decoder, the same one <video> uses, so playback works for
// any codec the browser can play even when decodeAudioData (used only for
// the waveform, see decodeWaveform.ts) can't decode it. "Has an audio track"
// is detected the same DOM-native way, independent of whether the waveform
// decode later succeeds — see detectHasAudioTrack below for which API.
import { needsResync, targetAudioSec } from './sync';

interface MinimalMediaStream {
  getAudioTracks(): unknown[];
  getTracks(): { stop(): void }[];
}

/** The subset of HTMLAudioElement this class touches — narrow enough to
 *  inject a fake in tests without a DOM. */
export interface AudioElementLike {
  src: string;
  currentTime: number;
  paused: boolean;
  volume: number;
  duration: number;
  /** The modern way to enumerate actual tracks. `HTMLMediaElement.audioTracks`
   *  (the old Media Source Extensions property) is UNIMPLEMENTED in current
   *  Chromium/Electron — verified empirically: `'audioTracks' in audioEl` is
   *  false even for files with a real audio track. captureStream() is the
   *  one that actually reports the truth. Optional so fakes in tests don't
   *  need it; its absence falls back to the duration heuristic below. */
  captureStream?(): MinimalMediaStream;
  play(): Promise<void>;
  pause(): void;
  removeAttribute(name: string): void;
  addEventListener(type: 'loadedmetadata', listener: () => void): void;
  removeEventListener(type: 'loadedmetadata', listener: () => void): void;
}

function createDefaultElement(): AudioElementLike {
  const el = document.createElement('audio');
  el.preload = 'auto';
  return el as unknown as AudioElementLike;
}

/** Whether `el`'s current resource has a playable audio track, independent
 *  of decodeAudioData (which only the waveform path uses and which rejects
 *  codecs this same element plays fine). Only meaningful after
 *  'loadedmetadata' has fired.
 *
 *  Uses captureStream().getAudioTracks() — confirmed against real files
 *  (silent vs. with-soundtrack) to correctly report 0 vs. 1+ audio tracks,
 *  unlike `duration`, which is > 0 for ANY valid container (video-only
 *  included) and so can't tell "video-only" from "has audio" on its own.
 *  Falls back to the duration heuristic only if captureStream itself isn't
 *  available, favoring a false "has audio" over a false "no audio". */
export function detectHasAudioTrack(el: AudioElementLike): boolean {
  if (typeof el.captureStream === 'function') {
    try {
      const stream = el.captureStream();
      const hasAudio = stream.getAudioTracks().length > 0;
      for (const track of stream.getTracks()) track.stop();
      return hasAudio;
    } catch {
      // Some codecs/containers can throw on captureStream() itself — fall
      // through to the duration heuristic rather than propagate.
    }
  }
  return el.duration > 0;
}

export class AudioPlayer {
  private readonly el: AudioElementLike;
  private currentUrl: string | null = null;
  private metadataListener: (() => void) | null = null;

  constructor(
    createElement: () => AudioElementLike = createDefaultElement,
    private readonly onHasAudioChange?: (hasAudio: boolean | null) => void,
  ) {
    this.el = createElement();
  }

  get hasSource(): boolean {
    return this.currentUrl !== null;
  }

  setSource(url: string | null): void {
    if (url === this.currentUrl) return;
    this.detachMetadataListener();
    this.currentUrl = url;
    if (url) {
      // Previous source's answer no longer applies — pending until this
      // source's own 'loadedmetadata' reports in.
      this.onHasAudioChange?.(null);
      this.el.src = url;
      this.metadataListener = () => this.onHasAudioChange?.(detectHasAudioTrack(this.el));
      this.el.addEventListener('loadedmetadata', this.metadataListener);
    } else {
      this.el.pause();
      this.el.removeAttribute('src');
      this.onHasAudioChange?.(null);
    }
  }

  private detachMetadataListener(): void {
    if (this.metadataListener) {
      this.el.removeEventListener('loadedmetadata', this.metadataListener);
      this.metadataListener = null;
    }
  }

  setVolume(v: number): void {
    this.el.volume = Math.max(0, Math.min(1, v));
  }

  /** Called on every clock tick: drift-corrected seek + play/pause to match
   *  the timeline. Cheap no-op when nothing is loaded. */
  sync(positionMs: number, isPlaying: boolean, offsetMs: number): void {
    if (!this.currentUrl) return;
    const targetSec = targetAudioSec(positionMs, offsetMs);
    if (needsResync(this.el.currentTime, targetSec)) {
      this.el.currentTime = targetSec;
    }
    if (isPlaying && this.el.paused) {
      void this.el.play().catch(() => {});
    } else if (!isPlaying && !this.el.paused) {
      this.el.pause();
    }
  }

  dispose(): void {
    this.detachMetadataListener();
    this.el.pause();
    this.el.removeAttribute('src');
  }
}
