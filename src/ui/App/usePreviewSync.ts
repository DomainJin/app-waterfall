import { useEffect, useState } from 'react';
import { useGeometry } from '../../store/physical';
import { useTimelineStore } from '../../store/timeline';
import { useValveStore } from '../../store/valve';

// Main-window side of the preview sync. The valve grid is precomputed ONCE
// up front (see useValveGridCompute) — this hook just forwards the finished
// grid (plus geometry) to the preview window whenever it changes, and a
// transport tick for the playhead. There is no live video sampling here:
// the preview reads the exact same flat array Play does, so replay is
// always identical regardless of how fast the video seeks on this run.
export function usePreviewSync() {
  const [previewReady, setPreviewReady] = useState(false);

  const geo = useGeometry();
  const valveGrid = useValveStore((s) => s.valveGrid);
  const gridRows = useValveStore((s) => s.gridRows);
  const gridCols = useValveStore((s) => s.gridCols);

  // Preview window announces itself; (re)send everything when it (re)opens.
  useEffect(() => {
    const bridge = window.previewSync;
    if (!bridge) return;
    return bridge.onPreviewNotify((msg) => {
      if (msg === 'ready') setPreviewReady(true);
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

  return { previewReady };
}
