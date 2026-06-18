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
  const clearPaint = useValveStore((s) => s.clearPaint);

  const frameAt = useSourceStore((s) => s.frameAt);
  // Re-draw when the valve layer's source identity changes.
  const masterName = useSourceStore((s) => s.masterName);
  const valveBinding = useSourceStore((s) => s.bindings.valve);

  const cols = geo.valve_cols;
  const B = geo.valve_bytes_per_frame;
  const row_ms = geo.row_interval_ms;
  const valveRows = Math.max(1, Math.ceil(durationMs / row_ms));
  const currentRow = Math.min(
    valveRows - 1,
    Math.max(0, Math.floor(positionMs / row_ms)),
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);

  // Draw the current row's frame + valve states. Keyed on currentRow (not
  // positionMs) so it only re-fetches when the row actually changes.
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    void (async () => {
      const img = await frameAt('valve', currentRow * row_ms);
      if (cancelled || !canvasRef.current) return;
      drawValveEditor(canvasRef.current, img, cols, threshold, paint, currentRow);
    })();
    return () => {
      cancelled = true;
    };
  }, [frameAt, currentRow, row_ms, cols, threshold, paint, masterName, valveBinding]);

  const paintCol = useCallback(
    (col: number) => {
      if (col < 0 || col >= cols) return;
      togglePaint(currentRow * cols + col);
    },
    [cols, currentRow, togglePaint],
  );

  const exportBin = useCallback(async () => {
    setExporting(true);
    setStatus('Building…');
    try {
      const bin = await buildValveBin({
        frameAt: (t) => frameAt('valve', t),
        cols,
        rows: valveRows,
        row_ms,
        B,
        threshold,
        paint,
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
  }, [frameAt, cols, valveRows, row_ms, B, threshold, paint, mode]);

  return {
    canvasRef,
    cols,
    valveRows,
    currentRow,
    threshold,
    mode,
    exporting,
    status,
    setThreshold,
    setMode,
    clearPaint,
    paintCol,
    exportBin,
  };
}
