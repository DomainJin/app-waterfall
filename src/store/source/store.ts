import { create } from 'zustand';
import { LAYER_IDS, type BindingKind, type LayerId } from '../../core/sources';
import { VideoSource } from '../../core/sources';
import { masterClock } from '../timeline';
import { bindings, getMaster, setMaster } from './registry';

interface BindingView {
  kind: BindingKind;
  ownName: string | null;
  /** Absolute fs path of the own source, if known (Electron only) — lets a
   *  saved project reload it without re-browsing. */
  ownPath: string | null;
}

type LoadKey = LayerId | 'master';

interface SourceState {
  masterName: string | null;
  /** Absolute fs path of the master source, if known (Electron only). */
  masterPath: string | null;
  masterDurationMs: number;
  bindings: Record<LayerId, BindingView>;
  loading: Partial<Record<LoadKey, boolean>>;
  error: string | null;

  loadMaster: (file: File, path?: string | null) => Promise<void>;
  loadOwn: (layer: LayerId, file: File, path?: string | null) => Promise<void>;
  /** Reload from a saved project's absolute path (no File picker involved). */
  loadMasterFromPath: (path: string) => Promise<void>;
  loadOwnFromPath: (layer: LayerId, path: string) => Promise<void>;
  useMaster: (layer: LayerId) => void;
  useOwn: (layer: LayerId) => void;
  /** Effective frame for a layer at time t — the single read path. */
  frameAt: (layer: LayerId, t_ms: number) => Promise<ImageData | null>;
  /** Drop a layer's queued-but-not-started reads (see IFrameSource.flushPending). */
  flushPending: (layer: LayerId) => void;
  /** Name of the source a layer currently resolves to. */
  resolvedName: (layer: LayerId) => string | null;
  /** Playable URL of the source a layer currently resolves to (for audio
   *  playback, which needs the element's src rather than a frame). */
  resolvedUrl: (layer: LayerId) => string | null;
}

const initialBindings = (): Record<LayerId, BindingView> => ({
  valve: { kind: 'master', ownName: null, ownPath: null },
  led: { kind: 'master', ownName: null, ownPath: null },
  audio: { kind: 'master', ownName: null, ownPath: null },
});

export const useSourceStore = create<SourceState>((set, get) => ({
  masterName: null,
  masterPath: null,
  masterDurationMs: 0,
  bindings: initialBindings(),
  loading: {},
  error: null,

  loadMaster: async (file, path = null) => {
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
        masterPath: path,
        masterDurationMs: m.durationMs,
        loading: { ...s.loading, master: false },
      }));
    } catch (err) {
      setMaster(null);
      set((s) => ({
        error: String(err),
        masterName: null,
        masterPath: null,
        loading: { ...s.loading, master: false },
      }));
    }
  },

  loadOwn: async (layer, file, path = null) => {
    set((s) => ({ loading: { ...s.loading, [layer]: true }, error: null }));
    try {
      const src = VideoSource.fromFile(file);
      await src.whenReady();
      bindings[layer].setOwn(src);
      set((s) => ({
        bindings: {
          ...s.bindings,
          [layer]: { kind: 'own', ownName: file.name, ownPath: path },
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

  loadMasterFromPath: async (path) => {
    set((s) => ({ loading: { ...s.loading, master: true }, error: null }));
    try {
      getMaster()?.dispose();
      const m = VideoSource.fromPath(path);
      setMaster(m);
      await m.whenReady();
      masterClock.setDuration(m.durationMs);
      set((s) => ({
        masterName: m.name,
        masterPath: path,
        masterDurationMs: m.durationMs,
        loading: { ...s.loading, master: false },
      }));
    } catch (err) {
      setMaster(null);
      set((s) => ({
        error: `Could not reload "${path}": ${String(err)}`,
        masterName: null,
        masterPath: null,
        loading: { ...s.loading, master: false },
      }));
    }
  },

  loadOwnFromPath: async (layer, path) => {
    set((s) => ({ loading: { ...s.loading, [layer]: true }, error: null }));
    try {
      const src = VideoSource.fromPath(path);
      await src.whenReady();
      bindings[layer].setOwn(src);
      set((s) => ({
        bindings: {
          ...s.bindings,
          [layer]: { kind: 'own', ownName: src.name, ownPath: path },
        },
        loading: { ...s.loading, [layer]: false },
      }));
    } catch (err) {
      set((s) => ({
        error: `Could not reload "${path}": ${String(err)}`,
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

  flushPending: (layer) => bindings[layer].flushPending(),

  resolvedName: (layer) => {
    const view = get().bindings[layer];
    return view.kind === 'own' ? view.ownName : get().masterName;
  },

  resolvedUrl: (layer) => bindings[layer].resolve()?.element.currentSrc || null,
}));

export { LAYER_IDS };
export type { LayerId };
