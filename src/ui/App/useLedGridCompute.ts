import { useEffect, useRef } from 'react';
import { sampleLedMatrix } from '../../core/layers/led';
import { useGeometry } from '../../store/physical';
import { useSourceStore } from '../../store/source';
import { useTimelineStore } from '../../store/timeline';
import { useLedStore } from '../../store/led';

// Unlike the valve grid (precomputed once for the WHOLE timeline, because
// every row's PAST sample stays visibly falling at the same time), the LED
// matrix only ever shows the CURRENT instant — there's nothing to stack, so
// it's sampled live as the playhead moves instead of precomputed up front.
//
// An in-flight guard + "pending" coalescing avoids piling up overlapping
// frameAt() calls if the playhead advances faster than a sample resolves
// (frameAt can involve a video seek).
export function useLedGridCompute() {
  const geo = useGeometry();
  const brightness = useLedStore((s) => s.brightness);
  const gamma = useLedStore((s) => s.gamma);
  const setMatrix = useLedStore((s) => s.setMatrix);
  const frameAt = useSourceStore((s) => s.frameAt);
  const masterName = useSourceStore((s) => s.masterName);
  const ledBinding = useSourceStore((s) => s.bindings.led);

  const cols = geo.led_cols;
  const rows = geo.led_rows;

  const inFlight = useRef(false);
  const pendingMs = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const sampleAt = (t_ms: number) => {
      if (inFlight.current) {
        pendingMs.current = t_ms;
        return;
      }
      inFlight.current = true;
      void frameAt('led', t_ms)
        .then((img) => {
          if (cancelled) return;
          const matrix = sampleLedMatrix(img, cols, rows, brightness, gamma);
          setMatrix(matrix, rows, cols);
        })
        .catch((err) => {
          console.warn('[led] sample failed', err);
        })
        .finally(() => {
          inFlight.current = false;
          if (!cancelled && pendingMs.current != null) {
            const next = pendingMs.current;
            pendingMs.current = null;
            sampleAt(next);
          }
        });
    };

    sampleAt(useTimelineStore.getState().positionMs);
    const unsub = useTimelineStore.subscribe((s) => sampleAt(s.positionMs));

    return () => {
      cancelled = true;
      unsub();
    };
  }, [cols, rows, brightness, gamma, frameAt, masterName, ledBinding.kind, ledBinding.ownName, setMatrix]);
}
