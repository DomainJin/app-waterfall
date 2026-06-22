import { create } from 'zustand';
import {
  cmdGetConfig,
  cmdSetTick,
  fetchVersion,
  ValveSocket,
  type SocketStatus,
} from '../../transport';

// The live socket lives in module scope (not in Zustand state). Shared by
// BOTH layers: valve sends JSON text commands, LED sends binary ic9803
// frames (magic "WL") over this SAME connection — the firmware tells them
// apart by the first 2 bytes of a binary frame (see codec/ic9803.ts).
let socket: ValveSocket | null = null;

let queueWarningTimer: ReturnType<typeof setTimeout> | null = null;

interface DeviceState {
  ip: string;
  wsPort: number; // shared valve + LED WebSocket
  httpPort: number; // /version (OTA) HTTP
  status: SocketStatus;
  /** True once a connection has succeeded at least once this session — lets
   *  the UI say "Reconnect" instead of "Connect" after an unexpected drop. */
  everConnected: boolean;
  /** Mechanical tick floor from the device, or null if unknown. */
  tickMs: number | null;
  /** Device-reported valve_count, or null. */
  valveCount: number | null;
  error: string | null;
  /** Set when a send was throttled because the device's queue is backed up;
   *  auto-clears a few seconds after the last overflow. Never silent. */
  queueWarning: string | null;

  setIp: (ip: string) => void;
  pollVersion: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendText: (text: string) => boolean;
  sendBinary: (buf: Uint8Array) => boolean;
  /** Sync row_interval_ms down (write direction, handoff §4). */
  sendSetTick: (ms: number) => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  ip: '192.168.1.222',
  wsPort: 3333,
  httpPort: 8080,
  status: 'disconnected',
  everConnected: false,
  tickMs: null,
  valveCount: null,
  error: null,
  queueWarning: null,

  setIp: (ip) => set({ ip }),

  // Read direction: HTTP poll, works without a WebSocket. Never blocks/throws.
  pollVersion: async () => {
    const { ip, httpPort } = get();
    const v = await fetchVersion(ip, httpPort);
    if (v) set({ tickMs: v.tickMs, valveCount: v.valveCount });
  },

  connect: async () => {
    const { ip, wsPort } = get();
    socket?.close();
    socket = new ValveSocket({
      onStatus: (s) => {
        set({ status: s });
        if (s === 'connected') set({ everConnected: true });
      },
      onQueueOverflow: (bufferedBytes) => {
        set({ queueWarning: `Device queue backlog: ${Math.round(bufferedBytes / 1024)} KB buffered — throttling sends until it drains.` });
        if (queueWarningTimer) clearTimeout(queueWarningTimer);
        queueWarningTimer = setTimeout(() => set({ queueWarning: null }), 3000);
      },
    });
    set({ error: null, queueWarning: null });
    try {
      await socket.connect(`ws://${ip}:${wsPort}`);
      await get().pollVersion(); // learn tickMs / valve_count on connect
      socket.sendText(cmdGetConfig());
    } catch (err) {
      set({ error: String(err) });
    }
  },

  disconnect: () => {
    socket?.close();
    socket = null;
    set({ status: 'disconnected' });
  },

  sendText: (text) => socket?.sendText(text) ?? false,
  sendBinary: (buf) => socket?.sendBinary(buf) ?? false,

  sendSetTick: (ms) => {
    socket?.sendText(cmdSetTick(ms));
  },
}));
