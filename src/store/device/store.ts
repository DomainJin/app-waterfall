import { create } from 'zustand';
import {
  cmdGetConfig,
  cmdSetTick,
  fetchVersion,
  ValveSocket,
  type SocketStatus,
} from '../../transport';

// The live socket lives in module scope (not in Zustand state).
let socket: ValveSocket | null = null;

interface DeviceState {
  ip: string;
  wsPort: number; // valve WebSocket
  httpPort: number; // /version (OTA) HTTP
  status: SocketStatus;
  /** Mechanical tick floor from the device, or null if unknown. */
  tickMs: number | null;
  /** Device-reported valve_count, or null. */
  valveCount: number | null;
  error: string | null;

  setIp: (ip: string) => void;
  pollVersion: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendText: (text: string) => boolean;
  /** Sync row_interval_ms down (write direction, handoff §4). */
  sendSetTick: (ms: number) => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  ip: '192.168.1.222',
  wsPort: 3333,
  httpPort: 8080,
  status: 'disconnected',
  tickMs: null,
  valveCount: null,
  error: null,

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
    socket = new ValveSocket((s) => set({ status: s }));
    set({ error: null });
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

  sendSetTick: (ms) => {
    socket?.sendText(cmdSetTick(ms));
  },
}));
