// Master timeline: a single millisecond clock that drives all three layers
// (play / pause / stop / scrub). The advancement loop is driven by
// requestAnimationFrame and is fully decoupled from React — React subscribes
// for a snapshot, it does not own the clock.
//
// The time-advancement math is isolated in `tick(now)` with an injectable
// `now` source, so it is deterministic and unit-testable without rAF.
import type { ClockListener, ClockSnapshot, MasterClockOptions } from './types';

const hasRaf =
  typeof requestAnimationFrame === 'function' &&
  typeof cancelAnimationFrame === 'function';

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

export class MasterClock {
  private _positionMs = 0;
  private _durationMs: number;
  private _isPlaying = false;
  private _rate = 1;
  private _fps: number;
  private _lastNow = 0;
  private readonly now: () => number;
  private readonly listeners = new Set<ClockListener>();
  private rafId: number | null = null;

  constructor(opts: MasterClockOptions = {}) {
    this._durationMs = Math.max(0, opts.durationMs ?? 0);
    this._fps = opts.fps && opts.fps > 0 ? opts.fps : 30;
    this.now = opts.now ?? (() => performance.now());
  }

  get positionMs(): number {
    return this._positionMs;
  }
  get durationMs(): number {
    return this._durationMs;
  }
  get isPlaying(): boolean {
    return this._isPlaying;
  }
  get rate(): number {
    return this._rate;
  }
  get fps(): number {
    return this._fps;
  }

  snapshot(): ClockSnapshot {
    return {
      positionMs: this._positionMs,
      durationMs: this._durationMs,
      isPlaying: this._isPlaying,
      rate: this._rate,
      fps: this._fps,
    };
  }

  // ── Transport ───────────────────────────────────────────────────────────

  play(): void {
    if (this._isPlaying) return;
    // Restart from 0 if parked at the end of a bounded timeline.
    if (this._durationMs > 0 && this._positionMs >= this._durationMs) {
      this._positionMs = 0;
    }
    this._isPlaying = true;
    this._lastNow = this.now();
    this.startRaf();
    this.emit();
  }

  pause(): void {
    if (!this._isPlaying) return;
    this._isPlaying = false;
    this.stopRaf();
    this.emit();
  }

  toggle(): void {
    this._isPlaying ? this.pause() : this.play();
  }

  stop(): void {
    this._isPlaying = false;
    this.stopRaf();
    this._positionMs = 0;
    this.emit();
  }

  /** Seek to an absolute ms position, clamped to the timeline bounds. */
  seek(ms: number): void {
    const hi = this._durationMs > 0 ? this._durationMs : Number.POSITIVE_INFINITY;
    this._positionMs = clamp(Number.isFinite(ms) ? ms : 0, 0, hi);
    this._lastNow = this.now(); // avoid a jump on the next tick while playing
    this.emit();
  }

  /** Step by ±1 frame (1000/fps ms). */
  stepFrame(direction: number): void {
    const frameMs = 1000 / this._fps;
    this.seek(this._positionMs + Math.sign(direction) * frameMs);
  }

  // ── Config ──────────────────────────────────────────────────────────────

  setDuration(ms: number): void {
    this._durationMs = Math.max(0, Number.isFinite(ms) ? ms : 0);
    if (this._durationMs > 0 && this._positionMs > this._durationMs) {
      this._positionMs = this._durationMs;
    }
    this.emit();
  }

  setRate(rate: number): void {
    this._rate = Number.isFinite(rate) && rate > 0 ? rate : 1;
    this._lastNow = this.now();
    this.emit();
  }

  setFps(fps: number): void {
    this._fps = Number.isFinite(fps) && fps > 0 ? fps : this._fps;
    this.emit();
  }

  // ── Advancement (pure given `now`) ────────────────────────────────────────

  /** Advance the clock to time `now`. No-op when paused. */
  tick(now: number = this.now()): void {
    if (!this._isPlaying) return;
    const dt = (now - this._lastNow) * this._rate;
    this._lastNow = now;
    this._positionMs += dt;

    if (this._durationMs > 0 && this._positionMs >= this._durationMs) {
      this._positionMs = this._durationMs;
      this._isPlaying = false;
      this.stopRaf();
    }
    this.emit();
  }

  // ── Subscription ──────────────────────────────────────────────────────────

  subscribe(listener: ClockListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }

  private startRaf(): void {
    if (!hasRaf || this.rafId !== null) return;
    const loop = () => {
      this.tick(this.now());
      this.rafId = this._isPlaying ? requestAnimationFrame(loop) : null;
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopRaf(): void {
    if (this.rafId !== null && hasRaf) {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
  }
}
