// A loaded video, queryable by time: frameAt(t_ms) -> ImageData.
//
// Decodes through a hidden <video> element seeked to the requested time, then
// draws to an offscreen canvas to read pixels back. Seeks are serialized (a
// <video> can only service one seek at a time) so concurrent frameAt() calls
// don't clobber each other. Needs the DOM (browser/Electron renderer).
import { clampTimeMs } from './clampTimeMs';
import type { IFrameSource } from './types';

export class VideoSource implements IFrameSource {
  readonly name: string;

  private readonly video: HTMLVideoElement;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly objectUrl: string | null;
  private readonly ready: Promise<void>;
  /** Serializes seeks: each frameAt waits for the previous to finish. */
  private seekChain: Promise<unknown> = Promise.resolve();

  private _durationMs = 0;
  private _width = 0;
  private _height = 0;

  private constructor(src: string, name: string, objectUrl: string | null) {
    this.name = name;
    this.objectUrl = objectUrl;

    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    v.src = src;
    this.video = v;

    this.ready = new Promise<void>((resolve, reject) => {
      const onMeta = () => {
        this._width = v.videoWidth;
        this._height = v.videoHeight;
        this._durationMs = (Number.isFinite(v.duration) ? v.duration : 0) * 1000;
        const c = document.createElement('canvas');
        c.width = Math.max(1, this._width);
        c.height = Math.max(1, this._height);
        this.canvas = c;
        this.ctx = c.getContext('2d', { willReadFrequently: true });
        resolve();
      };
      v.addEventListener('loadedmetadata', onMeta, { once: true });
      v.addEventListener(
        'error',
        () => reject(new Error(`Failed to load video: ${name}`)),
        { once: true },
      );
    });
  }

  static fromFile(file: File): VideoSource {
    const url = URL.createObjectURL(file);
    return new VideoSource(url, file.name, url);
  }

  static fromUrl(url: string, name?: string): VideoSource {
    return new VideoSource(url, name ?? url, null);
  }

  /** Reload from an absolute fs path (project Open) — no File object needed. */
  static fromPath(path: string): VideoSource {
    const toFileUrl = window.electronAPI?.pathToFileUrl;
    const url = toFileUrl ? toFileUrl(path) : path;
    const name = path.split(/[\\/]/).pop() || path;
    return new VideoSource(url, name, null);
  }

  /** Resolves once metadata (size/duration) is available. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  get durationMs(): number {
    return this._durationMs;
  }
  get width(): number {
    return this._width;
  }
  get height(): number {
    return this._height;
  }
  /** Underlying element (for synced playback / audio in later phases). */
  get element(): HTMLVideoElement {
    return this.video;
  }

  async frameAt(t_ms: number): Promise<ImageData> {
    await this.ready;
    if (!this.ctx || !this.canvas) throw new Error('VideoSource not ready');
    const targetSec = clampTimeMs(t_ms, this._durationMs) / 1000;
    const run = this.seekChain.then(() => this.seekAndGrab(targetSec));
    this.seekChain = run.catch(() => {}); // keep the chain alive on error
    return run;
  }

  /** Drop whatever's queued behind the current seek so the next frameAt()
   *  starts immediately. Anything already chained keeps running and will
   *  still settle on its own (its caller is awaiting it) — this only stops
   *  NEW work from queuing behind it. */
  flushPending(): void {
    this.seekChain = Promise.resolve();
  }

  // Under sustained rapid-fire seeking (live preview tracking playback), the
  // browser occasionally never fires 'seeked' for a particular target — a
  // real, observed hang, not hypothetical. Without a timeout, that single
  // stuck seek blocks the serialized seekChain FOREVER, freezing every future
  // frameAt() call too. A bounded timeout guarantees this promise always
  // settles, so one bad seek costs one missed frame instead of the whole feed.
  private static readonly SEEK_TIMEOUT_MS = 1200;

  private seekAndGrab(targetSec: number): Promise<ImageData> {
    return new Promise<ImageData>((resolve, reject) => {
      const v = this.video;
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        v.removeEventListener('seeked', onSeeked);
        reject(new Error(`seek timed out at ${targetSec.toFixed(3)}s`));
      }, VideoSource.SEEK_TIMEOUT_MS);
      const grab = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.ctx!.drawImage(v, 0, 0, this._width, this._height);
        resolve(this.ctx!.getImageData(0, 0, this._width, this._height));
      };
      // Already at the requested frame with data decoded? Grab immediately.
      if (Math.abs(v.currentTime - targetSec) < 1e-3 && v.readyState >= 2) {
        grab();
        return;
      }
      const onSeeked = () => {
        v.removeEventListener('seeked', onSeeked);
        grab();
      };
      v.addEventListener('seeked', onSeeked);
      try {
        v.currentTime = targetSec;
      } catch (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        v.removeEventListener('seeked', onSeeked);
        reject(err);
      }
    });
  }

  dispose(): void {
    this.video.removeAttribute('src');
    this.video.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.canvas = null;
    this.ctx = null;
  }
}
