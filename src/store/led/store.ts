import { create } from 'zustand';
import { PALETTES, type LedMode, type PaletteName } from '../../core/layers/led';
import {
  buildConfig,
  buildDataFrame,
  buildReset,
  ChannelOrder,
  Origin,
  Wiring,
  type RGB,
} from '../../codec/ic9803';
import { useDeviceStore } from '../device';

export type PayloadMode = 'rgb888' | 'packed16';
export type RunMode = 'live' | 'timestamped';

interface LedState {
  // Encoding/output config (CONFIG frame + per-DATA-frame flags)
  brightness: number; // 0..255
  gamma: number; // >0, 1 = identity
  mode: LedMode; // normal / focus / fade / mix — see LED_MODE_SPEC.md §3
  /** User-chosen base color (Normal/Focus/Fade). Default white. */
  baseColor: RGB;
  /** FADE: ~rows to close most of an on/off transition (1-20). */
  fadeSpeed: number;
  /** MIX_COLOR: which preset palette to cycle through. */
  paletteName: PaletteName;
  channelOrder: ChannelOrder;
  wiring: Wiring;
  origin: Origin;
  payloadMode: PayloadMode;
  runMode: RunMode;

  // Whole-timeline LED script, pre-computed from the valve grid by
  // useLedScriptCompute (LED_MODE_SPEC.md) — same row indexing as the
  // valve grid, RGB (3 bytes) per cell instead of 1 bit.
  script: Uint8Array | null;
  scriptRows: number;
  scriptCols: number;

  // Current row's colors, kept fresh as the playhead moves — a plain read
  // out of `script`, not a recompute. Drives the editor's single-row
  // preview and the live device stream.
  strip: RGB[] | null;
  stripCols: number;

  /** `${cols}` CONFIG was last sent for — re-sent only when geometry (or a
   *  fresh device connection) requires it. */
  configSentFor: string | null;

  setBrightness: (v: number) => void;
  setGamma: (v: number) => void;
  setMode: (m: LedMode) => void;
  setBaseColor: (c: RGB) => void;
  setFadeSpeed: (v: number) => void;
  setPaletteName: (name: PaletteName) => void;
  setChannelOrder: (o: ChannelOrder) => void;
  setWiring: (w: Wiring) => void;
  setOrigin: (o: Origin) => void;
  setPayloadMode: (m: PayloadMode) => void;
  setRunMode: (m: RunMode) => void;
  setScript: (script: Uint8Array | null, rows: number, cols: number) => void;
  setStrip: (strip: RGB[], cols: number) => void;

  /** Push CONFIG (if geometry/connection changed since last send) + the
   *  current strip as a DATA frame, over the SHARED valve+LED socket. */
  sendNow: () => void;
}

export const useLedStore = create<LedState>((set, get) => ({
  brightness: 255,
  gamma: 1,
  mode: 'normal',
  baseColor: { r: 255, g: 255, b: 255 },
  fadeSpeed: 6,
  paletteName: 'rainbow',
  channelOrder: ChannelOrder.RGB,
  wiring: Wiring.LINEAR,
  origin: Origin.TOP_LEFT,
  payloadMode: 'rgb888',
  runMode: 'live',

  script: null,
  scriptRows: 0,
  scriptCols: 0,
  strip: null,
  stripCols: 0,
  configSentFor: null,

  setBrightness: (v) => set({ brightness: Math.max(0, Math.min(255, Math.round(v))) }),
  setGamma: (v) => set({ gamma: Number.isFinite(v) && v > 0 ? v : 1 }),
  setMode: (m) => set({ mode: m }),
  setBaseColor: (c) => set({ baseColor: c }),
  setFadeSpeed: (v) => set({ fadeSpeed: Number.isFinite(v) ? Math.min(20, Math.max(1, Math.round(v))) : 6 }),
  setPaletteName: (name) => set({ paletteName: name in PALETTES ? name : 'rainbow' }),
  setChannelOrder: (o) => set({ channelOrder: o, configSentFor: null }),
  setWiring: (w) => set({ wiring: w, configSentFor: null }),
  setOrigin: (o) => set({ origin: o, configSentFor: null }),
  setPayloadMode: (m) => set({ payloadMode: m }),
  setRunMode: (m) => set({ runMode: m }),

  setScript: (script, rows, cols) => set({ script, scriptRows: rows, scriptCols: cols }),

  // No separate "auto-send" toggle — LED always streams over the shared
  // device connection once it's connected; sendNow() itself is a no-op
  // when not connected.
  setStrip: (strip, cols) => {
    set({ strip, stripCols: cols });
    get().sendNow();
  },

  sendNow: () => {
    const device = useDeviceStore.getState();
    if (device.status !== 'connected') {
      // Force a fresh CONFIG next time we (re)connect.
      if (get().configSentFor !== null) set({ configSentFor: null });
      return;
    }
    const { strip, stripCols, wiring, origin, channelOrder, payloadMode, runMode, configSentFor } =
      get();
    if (!strip || stripCols <= 0) return;

    const key = `${stripCols}`;
    if (configSentFor !== key) {
      // LED is a 1D strip — CONFIG always declares led_rows=1 (see
      // LED_ACTUAL_SPEC.md §5; the wire-format itself is unchanged).
      device.sendBinary(buildConfig(stripCols, 1, wiring, origin, channelOrder));
      set({ configSentFor: key });
    }
    device.sendBinary(
      buildDataFrame(strip, {
        packed: payloadMode === 'packed16',
        timestamped: runMode === 'timestamped',
        latch: true,
        order: channelOrder,
      }),
    );
  },
}));

// When the shared device connection comes up, clear the LED out (RESET) so
// stale state from a previous session doesn't linger; the next sendNow()
// will then send a fresh CONFIG (configSentFor was already cleared above
// while disconnected).
let wasConnected = false;
useDeviceStore.subscribe((s) => {
  const isConnected = s.status === 'connected';
  if (isConnected && !wasConnected) {
    s.sendBinary(buildReset());
  }
  wasConnected = isConnected;
});
