import { useEffect, useRef, useState } from 'react';
import { useGeometry } from '../../store/physical';
import { useLedStore } from '../../store/led';
import { useTimelineStore } from '../../store/timeline';
import { useValveStore } from '../../store/valve';

// Main-window side of the preview sync. Both the valve grid AND the LED
// script are pre-computed ONCE up front (see useValveGridCompute /
// useLedScriptCompute) — this hook just forwards the finished arrays
// (plus geometry) to the preview window whenever they change, and a
// transport tick for the playhead. There is no live sampling here: the
// preview reads the exact same flat arrays Play does (indexing by the
// current row itself), so replay is always identical regardless of how
// fast anything seeks on this run.
export function usePreviewSync() {
  const [previewReady, setPreviewReady] = useState(false);

  const geo = useGeometry();
  const valveGrid = useValveStore((s) => s.valveGrid);
  const gridRows = useValveStore((s) => s.gridRows);
  const gridCols = useValveStore((s) => s.gridCols);

  const ledScript = useLedStore((s) => s.script);
  const ledScriptRows = useLedStore((s) => s.scriptRows);
  const ledCols = useLedStore((s) => s.scriptCols);

  // A closed-then-reopened preview window is a BRAND NEW renderer with no
  // memory of anything sent before — it announces itself with another
  // 'ready', but `previewReady` is already true by then, so the effects
  // below (keyed on `[previewReady, ...]`) would never re-fire to give it
  // anything. Keep the latest values in a ref so the 'ready' handler can
  // always replay the CURRENT grid + transport snapshot immediately,
  // regardless of whether `previewReady` itself actually changed.
  const latestRef = useRef({ geo, valveGrid, gridRows, gridCols, ledScript, ledScriptRows, ledCols });
  latestRef.current = { geo, valveGrid, gridRows, gridCols, ledScript, ledScriptRows, ledCols };

  // Preview window announces itself; (re)send everything every time it
  // (re)opens, not just the first time.
  useEffect(() => {
    const bridge = window.previewSync;
    if (!bridge) return;
    return bridge.onPreviewNotify((msg) => {
      if (msg !== 'ready') return;
      setPreviewReady(true);

      const { geo, valveGrid, gridRows, gridCols, ledScript, ledScriptRows, ledCols } = latestRef.current;
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
      if (ledScript) {
        bridge.pushToPreview({ type: 'ledScript', cols: ledCols, rows: ledScriptRows, rgb: ledScript });
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

  // Push the precomputed valve grid whenever a fresh one lands. One message
  // per recompute (not streamed row by row) — the preview just indexes into it.
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

  // Push the precomputed LED script whenever a fresh one lands — same
  // one-message-per-recompute model as the valve grid, not a live re-push.
  useEffect(() => {
    const bridge = window.previewSync;
    if (!bridge || !previewReady || !ledScript) return;
    bridge.pushToPreview({ type: 'ledScript', cols: ledCols, rows: ledScriptRows, rgb: ledScript });
  }, [previewReady, ledScript, ledScriptRows, ledCols]);

  return { previewReady };
}
