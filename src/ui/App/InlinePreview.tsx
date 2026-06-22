import { useEffect, useRef, useState } from 'react';
import { DEFAULT_CURTAIN_HEIGHT_M, GRAVITY_M_S2 } from '../../core/physical';
import { useLedStore } from '../../store/led';
import { useGeometry } from '../../store/physical';
import { useTimelineStore } from '../../store/timeline';
import { useValveStore } from '../../store/valve';
import { drawCurtain, type CurtainState } from '../PreviewWindow/drawCurtain';

const DEFAULT_FALL_TIME_MS = Math.sqrt((2 * DEFAULT_CURTAIN_HEIGHT_M) / GRAVITY_M_S2) * 1000;
const RULER_HEIGHT_PX = 30;

export function InlinePreview() {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewHeight, setPreviewHeight] = useState(220);
  const geo = useGeometry();
  const valveGrid = useValveStore((s) => s.valveGrid);
  const gridRows = useValveStore((s) => s.gridRows);
  const gridCols = useValveStore((s) => s.gridCols);
  const ledScript = useLedStore((s) => s.script);
  const ledScriptRows = useLedStore((s) => s.scriptRows);
  const ledCols = useLedStore((s) => s.scriptCols);

  const stateRef = useRef<CurtainState>({
    grid: null,
    rows: 0,
    cols: 0,
    row_ms: 16,
    margin: 0,
    length_m: 0,
    positionMs: 0,
    durationMs: 0,
    fall_time_ms: DEFAULT_FALL_TIME_MS,
    ledScript: null,
    ledScriptRows: 0,
    ledCols: 0,
  });

  useEffect(() => {
    const s = stateRef.current;
    s.grid = valveGrid;
    s.rows = gridRows;
    s.cols = gridCols;
    s.row_ms = geo.row_interval_ms;
    s.margin = geo.edge_margin;
    s.length_m = geo.length_m;
    s.fall_time_ms = geo.fall_time_ms;
    s.ledScript = ledScript;
    s.ledScriptRows = ledScriptRows;
    s.ledCols = ledCols;
  }, [
    valveGrid,
    gridRows,
    gridCols,
    geo.row_interval_ms,
    geo.edge_margin,
    geo.length_m,
    geo.fall_time_ms,
    ledScript,
    ledScriptRows,
    ledCols,
  ]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const syncHeight = () => {
      const width = frame.clientWidth;
      const length = geo.length_m;
      const curtainHeight = geo.curtain_height_m;
      if (width <= 0 || length <= 0 || curtainHeight <= 0) return;
      setPreviewHeight(Math.round(RULER_HEIGHT_PX + width * (curtainHeight / length)));
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [geo.length_m, geo.curtain_height_m]);

  useEffect(() => {
    const syncTimeline = () => {
      const t = useTimelineStore.getState();
      const s = stateRef.current;
      s.positionMs = t.positionMs;
      s.durationMs = t.durationMs;
    };
    syncTimeline();
    return useTimelineStore.subscribe(syncTimeline);
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const parent = canvas.parentElement;
        if (parent) {
          const width = parent.clientWidth;
          const height = parent.clientHeight;
          if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
            canvas.width = width;
            canvas.height = height;
          }
        }
        drawCurtain(canvas, stateRef.current, true, true);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={frameRef}
      className="app-preview"
      style={{ height: previewHeight }}
      aria-label={`Live preview, ${geo.length_m}m by ${geo.curtain_height_m}m`}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
