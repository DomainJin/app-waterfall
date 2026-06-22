import { useEffect } from 'react';
import { computeLedScript, readLedScriptRow, PALETTES } from '../../core/layers/led';
import { currentRowAt } from '../../core/preview';
import { useGeometry } from '../../store/physical';
import { useLedStore } from '../../store/led';
import { useTimelineStore } from '../../store/timeline';
import { useValveStore } from '../../store/valve';

const DEBOUNCE_MS = 150;

// LED_MODE_SPEC.md: the LED script is pre-computed ENTIRELY from the valve
// grid (no video sampling) — same shape/row-indexing as the valve grid, so
// play/preview/export just READ it, exactly like the valve layer. Whenever
// the valve grid or LED config changes, recompute the whole script
// (debounced — it's synchronous and fast, but a slider drag still
// shouldn't recompute on every tick). The current row is then just an
// array read as the playhead moves, not a recompute.
export function useLedScriptCompute() {
  const geo = useGeometry();
  const valveGrid = useValveStore((s) => s.valveGrid);
  const gridRows = useValveStore((s) => s.gridRows);
  const gridCols = useValveStore((s) => s.gridCols);
  const mode = useLedStore((s) => s.mode);
  const baseColor = useLedStore((s) => s.baseColor);
  const fadeSpeed = useLedStore((s) => s.fadeSpeed);
  const paletteName = useLedStore((s) => s.paletteName);
  const brightness = useLedStore((s) => s.brightness);
  const gamma = useLedStore((s) => s.gamma);
  const setScript = useLedStore((s) => s.setScript);
  const setStrip = useLedStore((s) => s.setStrip);
  const script = useLedStore((s) => s.script);
  const scriptRows = useLedStore((s) => s.scriptRows);
  const scriptCols = useLedStore((s) => s.scriptCols);

  const ledCols = geo.led_cols;
  const row_ms = geo.row_interval_ms;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!valveGrid || gridRows <= 0 || gridCols <= 0 || ledCols <= 0) {
        setScript(null, 0, 0);
        return;
      }
      const result = computeLedScript(valveGrid, gridRows, gridCols, ledCols, {
        mode,
        baseColor,
        fadeSpeed,
        palette: PALETTES[paletteName],
        brightness,
        gamma,
      });
      setScript(result, gridRows, ledCols);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [valveGrid, gridRows, gridCols, ledCols, mode, baseColor, fadeSpeed, paletteName, brightness, gamma, setScript]);

  // Drive the "current row" output (editor preview + live device stream) —
  // a plain array read, re-synced whenever the script changes and on every
  // timeline tick in between recomputes.
  useEffect(() => {
    const sync = () => {
      if (!script || scriptRows <= 0 || scriptCols <= 0) return;
      const t = useTimelineStore.getState().positionMs;
      const row = currentRowAt(t, row_ms, scriptRows);
      if (row < 0) return;
      setStrip(readLedScriptRow(script, row, scriptCols), scriptCols);
    };
    sync();
    return useTimelineStore.subscribe(sync);
  }, [script, scriptRows, scriptCols, row_ms, setStrip]);
}
