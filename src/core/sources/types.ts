// Shared types for the source/binding layer. PURE / DOM-free.

/** Anything that can yield a frame at a given time. VideoSource implements it. */
export interface IFrameSource {
  readonly name: string;
  readonly durationMs: number;
  readonly width: number;
  readonly height: number;
  frameAt(t_ms: number): Promise<ImageData>;
  dispose(): void;
  /** Abandon any queued-but-not-yet-started reads so the NEXT frameAt() call
   *  starts immediately instead of waiting for stale work to drain (e.g. a
   *  fresh play session after a stop shouldn't wait out a backlog built up
   *  by the previous one). Optional — sources with no internal queue (e.g.
   *  test mocks) don't need it. */
  flushPending?(): void;
}

export type LayerId = 'valve' | 'led' | 'audio';
export const LAYER_IDS: readonly LayerId[] = ['valve', 'led', 'audio'];

export type BindingKind = 'master' | 'own';
