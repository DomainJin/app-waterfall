// Shared types for the source/binding layer. PURE / DOM-free.

/** Anything that can yield a frame at a given time. VideoSource implements it. */
export interface IFrameSource {
  readonly name: string;
  readonly durationMs: number;
  readonly width: number;
  readonly height: number;
  frameAt(t_ms: number): Promise<ImageData>;
  dispose(): void;
}

export type LayerId = 'valve' | 'led' | 'audio';
export const LAYER_IDS: readonly LayerId[] = ['valve', 'led', 'audio'];

export type BindingKind = 'master' | 'own';
