import { create } from 'zustand';
import {
  buildConfig,
  buildDataFrame,
  buildReset,
  ChannelOrder,
  Origin,
  Wiring,
  type RGB,
} from '../../codec/ic9803';
import { ValveSocket, type SocketStatus } from '../../transport';

export type PayloadMode = 'rgb888' | 'packed16';
export type RunMode = 'live' | 'timestamped';

// The live socket lives in module scope (not in Zustand state) — same
// pattern as the valve device store. ValveSocket is protocol-agnostic
// (connect/send/close over a WebSocket); reused here for the LED
// controller's connection too rather than duplicating an identical class.
let socket: ValveSocket | null = null;

interface LedState {
  // Encoding/output config (CONFIG frame + per-DATA-frame flags)
  brightness: number; // 0..255
  gamma: number; // >0, 1 = identity
  channelOrder: ChannelOrder;
  wiring: Wiring;
  origin: Origin;
  payloadMode: PayloadMode;
  runMode: RunMode;

  // Live-sampled matrix, kept fresh by useLedGridCompute as the playhead moves.
  matrix: RGB[] | null;
  matrixRows: number;
  matrixCols: number;

  // Device connection (ws://ip:3334)
  ip: string;
  wsPort: number;
  status: SocketStatus;
  error: string | null;
  /** Stream every matrix update to the device while connected. */
  autoSend: boolean;
  /** `${cols}x${rows}` CONFIG was last sent for — re-sent only when geometry changes. */
  configSentFor: string | null;

  setBrightness: (v: number) => void;
  setGamma: (v: number) => void;
  setChannelOrder: (o: ChannelOrder) => void;
  setWiring: (w: Wiring) => void;
  setOrigin: (o: Origin) => void;
  setPayloadMode: (m: PayloadMode) => void;
  setRunMode: (m: RunMode) => void;
  setMatrix: (matrix: RGB[], rows: number, cols: number) => void;

  setIp: (ip: string) => void;
  setAutoSend: (on: boolean) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Push CONFIG (if geometry changed since last send) + the current matrix as a DATA frame. */
  sendNow: () => void;
}

export const useLedStore = create<LedState>((set, get) => ({
  brightness: 255,
  gamma: 1,
  channelOrder: ChannelOrder.RGB,
  wiring: Wiring.LINEAR,
  origin: Origin.TOP_LEFT,
  payloadMode: 'rgb888',
  runMode: 'live',

  matrix: null,
  matrixRows: 0,
  matrixCols: 0,

  ip: '192.168.1.223',
  wsPort: 3334,
  status: 'disconnected',
  error: null,
  autoSend: false,
  configSentFor: null,

  setBrightness: (v) => set({ brightness: Math.max(0, Math.min(255, Math.round(v))) }),
  setGamma: (v) => set({ gamma: Number.isFinite(v) && v > 0 ? v : 1 }),
  setChannelOrder: (o) => set({ channelOrder: o, configSentFor: null }),
  setWiring: (w) => set({ wiring: w, configSentFor: null }),
  setOrigin: (o) => set({ origin: o, configSentFor: null }),
  setPayloadMode: (m) => set({ payloadMode: m }),
  setRunMode: (m) => set({ runMode: m }),

  setMatrix: (matrix, rows, cols) => {
    set({ matrix, matrixRows: rows, matrixCols: cols });
    if (get().autoSend) get().sendNow();
  },

  setIp: (ip) => set({ ip }),
  setAutoSend: (on) => set({ autoSend: on }),

  connect: async () => {
    const { ip, wsPort } = get();
    socket?.close();
    socket = new ValveSocket((s) => set({ status: s }));
    set({ error: null, configSentFor: null });
    try {
      await socket.connect(`ws://${ip}:${wsPort}`);
      socket.sendBinary(buildReset());
    } catch (err) {
      set({ error: String(err) });
    }
  },

  disconnect: () => {
    socket?.close();
    socket = null;
    set({ status: 'disconnected', configSentFor: null });
  },

  sendNow: () => {
    if (!socket || get().status !== 'connected') return;
    const {
      matrix,
      matrixRows,
      matrixCols,
      wiring,
      origin,
      channelOrder,
      payloadMode,
      runMode,
      configSentFor,
    } = get();
    if (!matrix || matrixCols <= 0 || matrixRows <= 0) return;

    const key = `${matrixCols}x${matrixRows}`;
    if (configSentFor !== key) {
      socket.sendBinary(buildConfig(matrixCols, matrixRows, wiring, origin, channelOrder));
      set({ configSentFor: key });
    }
    socket.sendBinary(
      buildDataFrame(matrix, {
        packed: payloadMode === 'packed16',
        timestamped: runMode === 'timestamped',
        latch: true,
        order: channelOrder,
      }),
    );
  },
}));
