import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_CURTAIN_HEIGHT_M,
  GRAVITY_M_S2,
} from '../../core/physical';
import { drawCurtain, type CurtainState } from './drawCurtain';

// Sensible default before the main window's first 'grid' message arrives.
const DEFAULT_FALL_TIME_MS = Math.sqrt((2 * DEFAULT_CURTAIN_HEIGHT_M) / GRAVITY_M_S2) * 1000;

// Preview-window side. Receives the precomputed grid + transport over IPC
// into a mutable ref, and runs a requestAnimationFrame loop that renders the
// canvas from that ref — fully decoupled from React (no re-render per frame;
// only the layer toggle and the connected flag are React state).
export function usePreviewRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [valveOn, setValveOn] = useState(true);
  const valveOnRef = useRef(true);
  const [ledOn, setLedOn] = useState(true);
  const ledOnRef = useRef(true);
  const [connected, setConnected] = useState(false);

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
    valveOnRef.current = valveOn;
  }, [valveOn]);

  useEffect(() => {
    ledOnRef.current = ledOn;
  }, [ledOn]);

  useEffect(() => {
    const bridge = window.previewSync;
    const off = bridge?.onPreviewData((msg) => {
      const s = stateRef.current;
      if (msg.type === 'grid') {
        s.grid = msg.bits;
        s.rows = msg.rows;
        s.cols = msg.cols;
        s.row_ms = msg.row_ms;
        s.margin = msg.margin;
        s.length_m = msg.length_m;
        s.fall_time_ms = msg.fall_time_ms;
      } else if (msg.type === 'transport') {
        s.positionMs = msg.positionMs;
        s.durationMs = msg.durationMs;
      } else if (msg.type === 'ledScript') {
        s.ledScript = msg.rgb;
        s.ledScriptRows = msg.rows;
        s.ledCols = msg.cols;
      }
      setConnected(true);
    });

    // Announce readiness so the main window starts pushing.
    bridge?.notifyMain('ready');

    let raf = 0;
    const loop = () => {
      const canvas = canvasRef.current;
      const s = stateRef.current;

      if (canvas) {
        const parent = canvas.parentElement;
        if (parent) {
          const w = parent.clientWidth;
          const h = parent.clientHeight;
          if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
            canvas.width = w;
            canvas.height = h;
          }
        }
        drawCurtain(canvas, s, valveOnRef.current, ledOnRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      off?.();
    };
  }, []);

  return {
    canvasRef,
    valveOn,
    toggleValve: () => setValveOn((v) => !v),
    ledOn,
    toggleLed: () => setLedOn((v) => !v),
    connected,
  };
}
