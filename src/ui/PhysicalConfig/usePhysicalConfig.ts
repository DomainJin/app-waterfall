import { useCallback, useEffect } from 'react';
import { useDeviceStore } from '../../store/device';
import { usePhysicalStore } from '../../store/physical';

// State wiring for the physical-config inputs. Keeps the field component thin.
// Also enforces the device tick floor on row_interval_ms (handoff §4): the
// firmware's mechanical floor (tickMs) is the minimum the user may enter.
export function usePhysicalConfig() {
  const length_m = usePhysicalStore((s) => s.length_m);
  const row_interval_ms = usePhysicalStore((s) => s.row_interval_ms);
  const fixedFrameBytes = usePhysicalStore((s) => s.fixedFrameBytes);
  const valveIndexBase = usePhysicalStore((s) => s.valveIndexBase);
  const led_rows = usePhysicalStore((s) => s.led_rows);

  const setLength = usePhysicalStore((s) => s.setLength);
  const setRowIntervalMs = usePhysicalStore((s) => s.setRowIntervalMs);
  const setFixedFrameBytes = usePhysicalStore((s) => s.setFixedFrameBytes);
  const setValveIndexBase = usePhysicalStore((s) => s.setValveIndexBase);
  const setLedRows = usePhysicalStore((s) => s.setLedRows);

  const deviceTickMs = useDeviceStore((s) => s.tickMs);
  const floor = deviceTickMs && deviceTickMs > 0 ? deviceTickMs : 1;
  const effectiveTick = Math.max(deviceTickMs ?? 0, row_interval_ms);

  // When the device floor is learned (or rises), bump a too-fast interval up.
  useEffect(() => {
    if (deviceTickMs && row_interval_ms < deviceTickMs) {
      setRowIntervalMs(deviceTickMs);
    }
  }, [deviceTickMs, row_interval_ms, setRowIntervalMs]);

  // Clamp manual entry to the device floor.
  const setRowIntervalClamped = useCallback(
    (ms: number) =>
      setRowIntervalMs(Math.max(floor, Number.isFinite(ms) ? ms : floor)),
    [floor, setRowIntervalMs],
  );

  return {
    length_m,
    row_interval_ms,
    fixedFrameBytes,
    valveIndexBase,
    led_rows,
    fixedOn: fixedFrameBytes != null,
    deviceTickMs,
    floor,
    effectiveTick,
    setLength,
    setRowIntervalMs: setRowIntervalClamped,
    setFixedFrameBytes,
    setValveIndexBase,
    setLedRows,
  };
}
