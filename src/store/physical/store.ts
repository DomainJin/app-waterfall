import { create } from 'zustand';
import {
  DEFAULT_LED_ROWS,
  DEFAULT_ROW_INTERVAL_MS,
  type ValveIndexBase,
} from '../../core/physical';

// Raw physical-config inputs. Geometry itself is *derived* (see useGeometry),
// never stored, so there is a single source of truth that can't drift.
interface PhysicalState {
  length_m: number;
  row_interval_ms: number;
  /** null = OFF (derive bytes from valve_cols). */
  fixedFrameBytes: number | null;
  valveIndexBase: ValveIndexBase;
  led_rows: number;

  setLength: (m: number) => void;
  setRowIntervalMs: (ms: number) => void;
  setFixedFrameBytes: (bytes: number | null) => void;
  setValveIndexBase: (base: ValveIndexBase) => void;
  setLedRows: (rows: number) => void;
}

export const usePhysicalStore = create<PhysicalState>((set) => ({
  length_m: 8,
  row_interval_ms: DEFAULT_ROW_INTERVAL_MS,
  fixedFrameBytes: null,
  valveIndexBase: 0,
  led_rows: DEFAULT_LED_ROWS,

  setLength: (m) => set({ length_m: Number.isFinite(m) && m >= 0 ? m : 0 }),
  setRowIntervalMs: (ms) =>
    set({ row_interval_ms: Number.isFinite(ms) && ms > 0 ? ms : 1 }),
  setFixedFrameBytes: (bytes) =>
    set({ fixedFrameBytes: bytes != null && bytes > 0 ? Math.floor(bytes) : null }),
  setValveIndexBase: (base) => set({ valveIndexBase: base === 1 ? 1 : 0 }),
  setLedRows: (rows) =>
    set({ led_rows: Number.isFinite(rows) && rows > 0 ? Math.floor(rows) : 1 }),
}));
