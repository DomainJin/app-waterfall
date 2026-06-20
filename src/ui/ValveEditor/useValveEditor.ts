import { useCallback, useEffect, useRef, useState } from 'react';
import { buildValveBin } from '../../core/layers/valve';
import { useGeometry } from '../../store/physical';
import { useSourceStore } from '../../store/source';
import { useTimelineStore } from '../../store/timeline';
import { useValveStore } from '../../store/valve';
import { drawValveEditor } from './draw';
import { downloadBin } from './download';

// All state/effects for the valve editor. The component just renders.
export function useValveEditor() {
  const geo = useGeometry();
  const positionMs = useTimelineStore((s) => s.positionMs);
  const durationMs = useTimelineStore((s) => s.durationMs);

  const threshold = useValveStore((s) => s.threshold);
  const mode = useValveStore((s) => s.mode);
  const paint = useValveStore((s) => s.paint);
  const setThreshold = useValveStore((s) => s.setThreshold);
  const setMode = useValveStore((s) => s.setMode);
  const togglePaint = useValveStore((s) => s.togglePaint);
  const paintColumn = useValveStore((s) => s.paintColumn);
  const clearPaint = useValveStore((s) => s.clearPaint);
  const valveGrid = useValveStore((s) => s.valveGrid);
  const gridRows = useValveStore((s) => s.gridRows);
  const gridCols = useValveStore((s) => s.gridCols);
  const computing = useValveStore((s) => s.computing);

  const frameAt = useSourceStore((s) => s.frameAt);
  // Re-draw when the valve layer's source identity changes.
  const masterName = useSourceStore((s) => s.masterName);
  const valveBinding = useSourceStore((s) => s.bindings.valve);

  const cols = geo.valve_cols;
  const B = geo.valve_bytes_per_frame;
  const row_ms = geo.row_interval_ms;
  const edge_margin = geo.edge_margin;
  const valveRows = Math.max(1, Math.ceil(durationMs / row_ms));
  const currentRow = Math.min(
    valveRows - 1,
    Math.max(0, Math.floor(positionMs / row_ms)),
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);

  // Draw the current row's frame + valve states. Keyed on currentRow (not
  // positionMs) so it only re-fetches when the row actually changes. This is
  // an on-demand probe for the editor's paint overlay only — independent of
  // the precomputed grid that drives Play/preview/export.
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    void (async () => {
      const img = await frameAt('valve', currentRow * row_ms);
      if (cancelled || !canvasRef.current) return;
      drawValveEditor(canvasRef.current, img, cols, threshold, paint, currentRow, edge_margin);
    })();
    return () => {
      cancelled = true;
    };
  }, [frameAt, currentRow, row_ms, cols, threshold, paint, edge_margin, masterName, valveBinding]);

  const paintCol = useCallback(
    (col: number, wholeColumn?: boolean) => {
      // Edge-margin valves are always off — not paintable.
      if (col < edge_margin || col >= cols - edge_margin) return;
      // Default: a click paints exactly ONE cell (currentRow, col) — that's
      // what lets a texture (a heart, a letter) be drawn row by row. Whole-
      // column paint is an explicit Shift+click gesture, not the default.
      if (wholeColumn) paintColumn(col, cols, valveRows, currentRow);
      else togglePaint(currentRow * cols + col);
    },
    [cols, edge_margin, currentRow, togglePaint, paintColumn, valveRows],
  );

  // Export reads the SAME precomputed grid Play and the preview use — no
  // separate re-sampling of the video, so the .bin is byte-for-byte what was
  // previewed.
  const gridReady = !computing && !!valveGrid && gridRows === valveRows && gridCols === cols;

  const exportBin = useCallback(() => {
    if (!gridReady || !valveGrid) {
      setStatus('Grid not ready yet — wait for the compute to finish.');
      return;
    }
    setExporting(true);
    setStatus('Building…');
    try {
      const bin = buildValveBin({
        grid: valveGrid,
        cols,
        rows: valveRows,
        row_ms,
        B,
        mode,
      });
      const frameSize = 4 + B;
      downloadBin(bin, 'waterfall_valve.bin');
      setStatus(`Exported ${bin.length} bytes (${bin.length / frameSize} frames)`);
    } catch (err) {
      setStatus(`Error: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  }, [gridReady, valveGrid, cols, valveRows, row_ms, B, mode]);

  return {
    canvasRef,
    cols,
    valveRows,
    currentRow,
    threshold,
    mode,
    exporting,
    computing,
    status,
    setThreshold,
    setMode,
    clearPaint,
    paintCol,
    exportBin,
  };
}
