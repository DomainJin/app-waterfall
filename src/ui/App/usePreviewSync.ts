import { useEffect, useRef, useState } from 'react';
import { flattenRgb } from '../../core/layers/led';
import { useGeometry } from '../../store/physical';
import { useLedStore } from '../../store/led';
import { useTimelineStore } from '../../store/timeline';
import { useValveStore } from '../../store/valve';

// Main-window side of the preview sync. The valve grid is precomputed ONCE
// up front (see useValveGridCompute) — this hook just forwards the finished
// grid (plus geometry) to the preview window whenever it changes, and a
// transport tick for the playhead. There is no live video sampling here:
// the preview reads the exact same flat array Play does, so replay is
// always identical regardless of how fast the video seeks on this run.
//
// The LED matrix (Phase 8) is the opposite: it has no history to replay, so
// it's just forwarded live as useLedGridCompute keeps it fresh.
export function usePreviewSync() {
  const [previewReady, setPreviewReady] = useState(false);

  const geo = useGeometry();
  const valveGrid = useValveStore((s) => s.valveGrid);
  const gridRows = useValveStore((s) => s.gridRows);
  const gridCols = useValveStore((s) => s.gridCols);

  const ledMatrix = useLedStore((s) => s.matrix);
  const ledRows = useLedStore((s) => s.matrixRows);
  const ledCols = useLedStore((s) => s.matrixCols);

  // A closed-then-reopened preview window is a BRAND NEW renderer with no
  // memory of anything sent before — it announces itself with another
  // 'ready', but `previewReady` is already true by then, so the effects
  // below (keyed on `[previewReady, ...]`) would never re-fire to give it
  // anything. Keep the latest values in a ref so the 'ready' handler can
  // always replay the CURRENT grid + transport snapshot immediately,
  // regardless of whether `previewReady` itself actually changed.
  const latestRef = useRef({ geo, valveGrid, gridRows, gridCols, ledMatrix, ledRows, ledCols });
  latestRef.current = { geo, valveGrid, gridRows, gridCols, ledMatrix, ledRows, ledCols };

  // Preview window announces itself; (re)send everything every time it
  // (re)opens, not just the first time.
  useEffect(() => {
    const bridge = window.previewSync;
    if (!bridge) return;
    return bridge.onPreviewNotify((msg) => {
      if (msg !== 'ready') return;
      setPreviewReady(true);

      const { geo, valveGrid, gridRows, gridCols, ledMatrix, ledRows, ledCols } = latestRef.current;
      if (valveGrid) {
        bridge.pushToPreview({
          type: 'grid',
          cols: gridCols,
          rows: gridRows,
          row_ms: geo.row_interval_ms,
          margin: geo.edge_margin,
          length_m: geo.length_m,
          fall_time_ms: geo.fall_time_ms,
          bits: valveGrid,
        });
      }
      if (ledMatrix) {
        bridge.pushToPreview({ type: 'led', cols: ledCols, rows: ledRows, rgb: flattenRgb(ledMatrix) });
      }
      const t = useTimelineStore.getState();
      bridge.pushToPreview({
        type: 'transport',
        positionMs: t.positionMs,
        isPlaying: t.isPlaying,
        durationMs: t.durationMs,
      });
    });
  }, []);

  // Transport: subscribe to the clock directly (fires ~60/s while playing) and
  // push without re-rendering React.
  useEffect(() => {
    const bridge = window.previewSync;
    if (!bridge || !previewReady) return;
    const push = () => {
      const s = useTimelineStore.getState();
      bridge.pushToPreview({
        type: 'transport',
        positionMs: s.positionMs,
        isPlaying: s.isPlaying,
        durationMs: s.durationMs,
      });
    };
    push();
    return useTimelineStore.subscribe(push);
  }, [previewReady]);

  // Push the precomputed grid whenever a fresh one lands. One message per
  // recompute (not streamed row by row) — the preview just indexes into it.
  useEffect(() => {
    const bridge = window.previewSync;
    if (!bridge || !previewReady || !valveGrid) return;
    bridge.pushToPreview({
      type: 'grid',
      cols: gridCols,
      rows: gridRows,
      row_ms: geo.row_interval_ms,
      margin: geo.edge_margin,
      length_m: geo.length_m,
      fall_time_ms: geo.fall_time_ms,
      bits: valveGrid,
    });
  }, [
    previewReady,
    valveGrid,
    gridRows,
    gridCols,
    geo.row_interval_ms,
    geo.edge_margin,
    geo.length_m,
    geo.fall_time_ms,
  ]);

  // Push the LED matrix live, every time useLedGridCompute refreshes it —
  // there's no "one precompute, many reads" here, just whatever the
  // playhead currently sees.
  useEffect(() => {
    const bridge = window.previewSync;
    if (!bridge || !previewReady || !ledMatrix) return;
    bridge.pushToPreview({ type: 'led', cols: ledCols, rows: ledRows, rgb: flattenRgb(ledMatrix) });
  }, [previewReady, ledMatrix, ledRows, ledCols]);

  return { previewReady };
}
