import { useCallback, useEffect, useRef, useState } from 'react';
import { buildLedScriptFile } from '../../core/layers/led';
import { useGeometry } from '../../store/physical';
import { useLedStore } from '../../store/led';
import { downloadBin } from '../download';
import { drawLedStrip } from './draw';

// All state/effects for the LED editor. The component just renders. The
// strip itself (current row of the pre-computed ledScript) is kept fresh by
// useLedScriptCompute (mounted once at the App level) — this hook just
// reads it and the rest of the LED config. LED has no connection UI of its
// own: it streams over the shared valve+LED socket (see DevicePanel /
// store/device).
export function useLedEditor() {
  const geo = useGeometry();

  const strip = useLedStore((s) => s.strip);
  const stripCols = useLedStore((s) => s.stripCols);
  const script = useLedStore((s) => s.script);
  const scriptRows = useLedStore((s) => s.scriptRows);
  const scriptCols = useLedStore((s) => s.scriptCols);

  const brightness = useLedStore((s) => s.brightness);
  const gamma = useLedStore((s) => s.gamma);
  const mode = useLedStore((s) => s.mode);
  const baseColor = useLedStore((s) => s.baseColor);
  const fadeSpeed = useLedStore((s) => s.fadeSpeed);
  const paletteName = useLedStore((s) => s.paletteName);
  const channelOrder = useLedStore((s) => s.channelOrder);
  const wiring = useLedStore((s) => s.wiring);
  const origin = useLedStore((s) => s.origin);
  const payloadMode = useLedStore((s) => s.payloadMode);
  const runMode = useLedStore((s) => s.runMode);

  const setBrightness = useLedStore((s) => s.setBrightness);
  const setGamma = useLedStore((s) => s.setGamma);
  const setMode = useLedStore((s) => s.setMode);
  const setBaseColor = useLedStore((s) => s.setBaseColor);
  const setFadeSpeed = useLedStore((s) => s.setFadeSpeed);
  const setPaletteName = useLedStore((s) => s.setPaletteName);
  const setChannelOrder = useLedStore((s) => s.setChannelOrder);
  const setWiring = useLedStore((s) => s.setWiring);
  const setOrigin = useLedStore((s) => s.setOrigin);
  const setPayloadMode = useLedStore((s) => s.setPayloadMode);
  const setRunMode = useLedStore((s) => s.setRunMode);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawLedStrip(canvas, strip, stripCols);
  }, [strip, stripCols]);

  // Export reads the SAME precomputed script the editor preview and live
  // device stream read — no separate re-derivation, so the file is
  // byte-for-byte what was previewed/streamed.
  const scriptReady = !!script && scriptRows > 0 && scriptCols > 0;

  const exportScript = useCallback(() => {
    if (!scriptReady || !script) {
      setStatus('Script not ready yet — wait for the compute to finish.');
      return;
    }
    setExporting(true);
    setStatus('Building…');
    try {
      const file = buildLedScriptFile({
        script,
        rows: scriptRows,
        cols: scriptCols,
        row_ms: geo.row_interval_ms,
        wiring,
        origin,
        channelOrder,
        payloadMode,
      });
      downloadBin(file, 'waterfall_led.bin');
      setStatus(`Exported ${file.length} bytes (${scriptRows} rows)`);
    } catch (err) {
      setStatus(`Error: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  }, [scriptReady, script, scriptRows, scriptCols, geo.row_interval_ms, wiring, origin, channelOrder, payloadMode]);

  return {
    canvasRef,
    cols: geo.led_cols,
    scriptRows,
    exporting,
    status,
    exportScript,
    brightness,
    gamma,
    mode,
    baseColor,
    fadeSpeed,
    paletteName,
    channelOrder,
    wiring,
    origin,
    payloadMode,
    runMode,
    setBrightness,
    setGamma,
    setMode,
    setBaseColor,
    setFadeSpeed,
    setPaletteName,
    setChannelOrder,
    setWiring,
    setOrigin,
    setPayloadMode,
    setRunMode,
  };
}
