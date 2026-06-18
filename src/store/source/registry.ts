import {
  SourceBinding,
  VideoSource,
  type LayerId,
} from '../../core/sources';

// The source/VideoSource instances live here (module scope, not in Zustand
// state) so per-frame seeking never churns React. The store holds only a
// lightweight view of each binding.

let master: VideoSource | null = null;

export const getMaster = (): VideoSource | null => master;

export function setMaster(next: VideoSource | null): void {
  master = next;
}

/** Per-layer bindings, each resolving lazily to the current master. */
export const bindings: Record<LayerId, SourceBinding<VideoSource>> = {
  valve: new SourceBinding(getMaster),
  led: new SourceBinding(getMaster),
  audio: new SourceBinding(getMaster),
};
