import { create } from 'zustand';
import { LAYER_IDS, type BindingKind, type LayerId } from '../../core/sources';
import { VideoSource } from '../../core/sources';
import { masterClock } from '../timeline';
import { bindings, getMaster, setMaster } from './registry';

interface BindingView {
  kind: BindingKind;
  ownName: string | null;
}

type LoadKey = LayerId | 'master';

interface SourceState {
  masterName: string | null;
  masterDurationMs: number;
  bindings: Record<LayerId, BindingView>;
  loading: Partial<Record<LoadKey, boolean>>;
  error: string | null;

  loadMaster: (file: File) => Promise<void>;
  loadOwn: (layer: LayerId, file: File) => Promise<void>;
  useMaster: (layer: LayerId) => void;
  useOwn: (layer: LayerId) => void;
  /** Effective frame for a layer at time t — the single read path. */
  frameAt: (layer: LayerId, t_ms: number) => Promise<ImageData | null>;
  /** Name of the source a layer currently resolves to. */
  resolvedName: (layer: LayerId) => string | null;
}

const initialBindings = (): Record<LayerId, BindingView> => ({
  valve: { kind: 'master', ownName: null },
  led: { kind: 'master', ownName: null },
  audio: { kind: 'master', ownName: null },
});

export const useSourceStore = create<SourceState>((set, get) => ({
  masterName: null,
  masterDurationMs: 0,
  bindings: initialBindings(),
  loading: {},
  error: null,

  loadMaster: async (file) => {
    set((s) => ({ loading: { ...s.loading, master: true }, error: null }));
    try {
      getMaster()?.dispose();
      const m = VideoSource.fromFile(file);
      setMaster(m);
      await m.whenReady();
      // Connect the loaded video to the master clock so scrubbing matches.
      masterClock.setDuration(m.durationMs);
      set((s) => ({
        masterName: file.name,
        masterDurationMs: m.durationMs,
        loading: { ...s.loading, master: false },
      }));
    } catch (err) {
      setMaster(null);
      set((s) => ({
        error: String(err),
        masterName: null,
        loading: { ...s.loading, master: false },
      }));
    }
  },

  loadOwn: async (layer, file) => {
    set((s) => ({ loading: { ...s.loading, [layer]: true }, error: null }));
    try {
      const src = VideoSource.fromFile(file);
      await src.whenReady();
      bindings[layer].setOwn(src);
      set((s) => ({
        bindings: {
          ...s.bindings,
          [layer]: { kind: 'own', ownName: file.name },
        },
        loading: { ...s.loading, [layer]: false },
      }));
    } catch (err) {
      set((s) => ({
        error: String(err),
        loading: { ...s.loading, [layer]: false },
      }));
    }
  },

  useMaster: (layer) => {
    bindings[layer].useMaster();
    set((s) => ({
      bindings: {
        ...s.bindings,
        [layer]: { ...s.bindings[layer], kind: 'master' },
      },
    }));
  },

  useOwn: (layer) => {
    if (bindings[layer].useOwn()) {
      set((s) => ({
        bindings: {
          ...s.bindings,
          [layer]: { ...s.bindings[layer], kind: 'own' },
        },
      }));
    }
  },

  frameAt: (layer, t_ms) => bindings[layer].frameAt(t_ms),

  resolvedName: (layer) => {
    const view = get().bindings[layer];
    return view.kind === 'own' ? view.ownName : get().masterName;
  },
}));

export { LAYER_IDS };
export type { LayerId };
