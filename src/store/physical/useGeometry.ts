import { useMemo } from 'react';
import { computeGeometry, type Geometry } from '../../core/physical';
import { usePhysicalStore } from './store';

/**
 * Derived geometry for the current physical config. Selects primitives (so
 * the snapshot is stable for React 18's useSyncExternalStore) and recomputes
 * the geometry object only when an input actually changes.
 */
export function useGeometry(): Geometry {
  const length_m = usePhysicalStore((s) => s.length_m);
  const row_interval_ms = usePhysicalStore((s) => s.row_interval_ms);
  const fixedFrameBytes = usePhysicalStore((s) => s.fixedFrameBytes);
  const valveIndexBase = usePhysicalStore((s) => s.valveIndexBase);
  const led_rows = usePhysicalStore((s) => s.led_rows);

  return useMemo(
    () =>
      computeGeometry(length_m, {
        row_interval_ms,
        fixedFrameBytes,
        valveIndexBase,
        led_rows,
      }),
    [length_m, row_interval_ms, fixedFrameBytes, valveIndexBase, led_rows],
  );
}
