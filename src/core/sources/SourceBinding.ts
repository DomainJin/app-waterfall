// SourceBinding: resolves a layer's source to either the shared "master"
// video or its own loaded file, then exposes a uniform frameAt(t_ms). This is
// the key abstraction that makes the processing pipeline source-agnostic —
// switching a layer between master and its own file never changes the
// pipeline, only which frames it reads.
//
// PURE / DOM-free so it is unit-testable with mock sources.
import type { BindingKind, IFrameSource } from './types';

export class SourceBinding<T extends IFrameSource = IFrameSource> {
  private _kind: BindingKind = 'master';
  private _own: T | null = null;

  /** `getMaster` is read lazily, so master can be (re)loaded after binding. */
  constructor(private readonly getMaster: () => T | null) {}

  get kind(): BindingKind {
    return this._kind;
  }
  get own(): T | null {
    return this._own;
  }
  /** True when this layer reads its own file rather than the master. */
  get isDecoupled(): boolean {
    return this._kind === 'own';
  }

  useMaster(): void {
    this._kind = 'master';
  }

  /** Switch back to a previously loaded own source. No-op if none loaded. */
  useOwn(): boolean {
    if (this._own) {
      this._kind = 'own';
      return true;
    }
    return false;
  }

  /** Load (or clear) an own source. Loading one decouples the layer. */
  setOwn(source: T | null): void {
    this._own = source;
    this._kind = source ? 'own' : 'master';
  }

  /** The source this binding currently reads from (may be null if unloaded). */
  resolve(): T | null {
    return this._kind === 'own' ? this._own : this.getMaster();
  }

  /** Uniform frame access — the single entry point every layer uses. */
  async frameAt(t_ms: number): Promise<ImageData | null> {
    const source = this.resolve();
    return source ? source.frameAt(t_ms) : null;
  }

  /** See IFrameSource.flushPending. No-op if the source doesn't support it. */
  flushPending(): void {
    this.resolve()?.flushPending?.();
  }
}
