// Shape of a saved .wfp project file. PURE / DOM-free — see serialize.ts /
// deserialize.ts for the (de)serialization logic that uses these types.
import type { ValveIndexBase } from '../physical';
import type { ValveMode } from '../layers/valve';
import type { LedMode, PaletteName } from '../layers/led';
import type { ChannelOrder, Origin, Wiring, RGB } from '../../codec/ic9803';
import type { BindingKind, LayerId } from '../sources';

export const PROJECT_FILE_VERSION = 1;

export interface ProjectPhysical {
  length_m: number;
  row_interval_ms: number;
  fixedFrameBytes: number | null;
  valveIndexBase: ValveIndexBase;
  edge_margin: number;
  curtain_height_m: number;
}

export interface ProjectDevice {
  ip: string;
  wsPort: number;
  httpPort: number;
}

export interface ProjectValve {
  threshold: number;
  invert: boolean;
  flipH: boolean;
  flipV: boolean;
  mode: ValveMode;
  paint: Record<number, boolean>;
}

export interface ProjectLed {
  brightness: number;
  gamma: number;
  mode: LedMode;
  baseColor: RGB;
  fadeSpeed: number;
  paletteName: PaletteName;
  channelOrder: ChannelOrder;
  wiring: Wiring;
  origin: Origin;
  payloadMode: 'rgb888' | 'packed16';
  runMode: 'live' | 'timestamped';
}

export interface ProjectAudio {
  offsetMs: number;
  volume: number;
}

export interface ProjectSourceRef {
  name: string;
  /** Absolute fs path, if known (Electron only) — null when the file was
   *  picked in a plain-browser context and only its name is recoverable. */
  path: string | null;
}

export interface ProjectBinding {
  kind: BindingKind;
  own: ProjectSourceRef | null;
}

export interface ProjectSources {
  master: ProjectSourceRef | null;
  bindings: Record<LayerId, ProjectBinding>;
}

export interface ProjectFile {
  version: number;
  savedAt: string;
  physical: ProjectPhysical;
  device: ProjectDevice;
  valve: ProjectValve;
  led: ProjectLed;
  audio: ProjectAudio;
  sources: ProjectSources;
}
