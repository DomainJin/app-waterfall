import { create } from 'zustand';
import {
  ProjectFileError,
  parseProjectFile,
  serializeProjectFile,
  type ProjectFile,
  type ProjectSnapshotInputs,
  type ProjectSources,
} from '../../core/project';
import { useAudioStore } from '../audio';
import { useDeviceStore } from '../device';
import { useLedStore } from '../led';
import { usePhysicalStore } from '../physical';
import { LAYER_IDS, useSourceStore } from '../source';
import { useValveStore } from '../valve';

const LAST_PATH_KEY = 'waterfall:lastProjectPath';

function readLastPath(): string | null {
  try {
    return localStorage.getItem(LAST_PATH_KEY);
  } catch {
    return null;
  }
}

function rememberPath(path: string): void {
  try {
    localStorage.setItem(LAST_PATH_KEY, path);
  } catch {
    // Best-effort only — losing "remember last path" isn't worth surfacing.
  }
}

function gatherSnapshot(): ProjectSnapshotInputs {
  const physical = usePhysicalStore.getState();
  const device = useDeviceStore.getState();
  const valve = useValveStore.getState();
  const led = useLedStore.getState();
  const audio = useAudioStore.getState();
  const source = useSourceStore.getState();

  const bindings = {} as ProjectSources['bindings'];
  for (const layer of LAYER_IDS) {
    const b = source.bindings[layer];
    bindings[layer] = {
      kind: b.kind,
      own: b.ownName ? { name: b.ownName, path: b.ownPath } : null,
    };
  }

  return {
    physical: {
      length_m: physical.length_m,
      row_interval_ms: physical.row_interval_ms,
      fixedFrameBytes: physical.fixedFrameBytes,
      valveIndexBase: physical.valveIndexBase,
      edge_margin: physical.edge_margin,
      curtain_height_m: physical.curtain_height_m,
    },
    device: { ip: device.ip, wsPort: device.wsPort, httpPort: device.httpPort },
    valve: {
      threshold: valve.threshold,
      invert: valve.invert,
      flipH: valve.flipH,
      flipV: valve.flipV,
      mode: valve.mode,
      paint: valve.paint,
    },
    led: {
      brightness: led.brightness,
      gamma: led.gamma,
      mode: led.mode,
      baseColor: led.baseColor,
      fadeSpeed: led.fadeSpeed,
      paletteName: led.paletteName,
      channelOrder: led.channelOrder,
      wiring: led.wiring,
      origin: led.origin,
      payloadMode: led.payloadMode,
      runMode: led.runMode,
    },
    audio: { offsetMs: audio.offsetMs, volume: audio.volume },
    sources: {
      master: source.masterName ? { name: source.masterName, path: source.masterPath } : null,
      bindings,
    },
  };
}

/** Applies a loaded project file to every store. Source reloads are
 *  best-effort: a layer whose own/master path can't be reloaded (moved file,
 *  or no path recorded — e.g. saved from a plain-browser session) falls back
 *  to "master" and the failure is surfaced via the source store's error, not
 *  thrown — the rest of the project (physical/valve/led/audio/device) still
 *  applies. */
async function applySnapshot(file: ProjectFile): Promise<void> {
  usePhysicalStore.setState(file.physical);
  useDeviceStore.setState({
    ip: file.device.ip,
    wsPort: file.device.wsPort,
    httpPort: file.device.httpPort,
  });
  useValveStore.setState({
    threshold: file.valve.threshold,
    invert: file.valve.invert,
    flipH: file.valve.flipH,
    flipV: file.valve.flipV,
    mode: file.valve.mode,
    paint: file.valve.paint,
  });
  useLedStore.setState({
    brightness: file.led.brightness,
    gamma: file.led.gamma,
    mode: file.led.mode,
    baseColor: file.led.baseColor,
    fadeSpeed: file.led.fadeSpeed,
    paletteName: file.led.paletteName,
    channelOrder: file.led.channelOrder,
    wiring: file.led.wiring,
    origin: file.led.origin,
    payloadMode: file.led.payloadMode,
    runMode: file.led.runMode,
  });
  useAudioStore.setState({ offsetMs: file.audio.offsetMs, volume: file.audio.volume });

  if (file.sources.master?.path) {
    await useSourceStore.getState().loadMasterFromPath(file.sources.master.path);
  }
  for (const layer of LAYER_IDS) {
    const binding = file.sources.bindings[layer];
    if (binding?.kind === 'own' && binding.own?.path) {
      await useSourceStore.getState().loadOwnFromPath(layer, binding.own.path);
    } else {
      useSourceStore.getState().useMaster(layer);
    }
  }
}

interface ProjectState {
  currentPath: string | null;
  busy: boolean;
  error: string | null;
  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  openProject: () => Promise<void>;
  clearError: () => void;
}

async function writeProjectTo(path: string): Promise<void> {
  const api = window.electronAPI;
  if (!api) throw new Error('Save is only available in the desktop app.');
  const json = serializeProjectFile(gatherSnapshot());
  await api.writeFile(path, json);
  rememberPath(path);
  useProjectStore.setState({ currentPath: path });
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentPath: readLastPath(),
  busy: false,
  error: null,

  saveProject: async () => {
    const path = get().currentPath;
    if (!path) return get().saveProjectAs();
    set({ busy: true, error: null });
    try {
      await writeProjectTo(path);
    } catch (err) {
      set({ error: `Save failed: ${String(err)}` });
    } finally {
      set({ busy: false });
    }
  },

  saveProjectAs: async () => {
    const api = window.electronAPI;
    if (!api) {
      set({ error: 'Save is only available in the desktop app.' });
      return;
    }
    set({ busy: true, error: null });
    try {
      const path = await api.showSaveProjectDialog(get().currentPath);
      if (!path) return; // user cancelled
      await writeProjectTo(path);
    } catch (err) {
      set({ error: `Save failed: ${String(err)}` });
    } finally {
      set({ busy: false });
    }
  },

  openProject: async () => {
    const api = window.electronAPI;
    if (!api) {
      set({ error: 'Open is only available in the desktop app.' });
      return;
    }
    set({ busy: true, error: null });
    try {
      const path = await api.showOpenProjectDialog(get().currentPath);
      if (!path) return; // user cancelled
      const json = await api.readFile(path);
      const file = parseProjectFile(json);
      await applySnapshot(file);
      rememberPath(path);
      set({ currentPath: path });
    } catch (err) {
      const msg = err instanceof ProjectFileError ? err.message : `Open failed: ${String(err)}`;
      set({ error: msg });
    } finally {
      set({ busy: false });
    }
  },

  clearError: () => set({ error: null }),
}));
