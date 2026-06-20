import { useEffect, useRef } from 'react';
import { useGeometry } from '../../store/physical';
import { useLedStore } from '../../store/led';
import { drawLedMatrix } from './draw';

// All state/effects for the LED editor. The component just renders. The
// live matrix itself is kept fresh by useLedGridCompute (mounted once at
// the App level) — this hook just reads it and the rest of the LED config.
export function useLedEditor() {
  const geo = useGeometry();

  const matrix = useLedStore((s) => s.matrix);
  const matrixRows = useLedStore((s) => s.matrixRows);
  const matrixCols = useLedStore((s) => s.matrixCols);

  const brightness = useLedStore((s) => s.brightness);
  const gamma = useLedStore((s) => s.gamma);
  const channelOrder = useLedStore((s) => s.channelOrder);
  const wiring = useLedStore((s) => s.wiring);
  const origin = useLedStore((s) => s.origin);
  const payloadMode = useLedStore((s) => s.payloadMode);
  const runMode = useLedStore((s) => s.runMode);

  const setBrightness = useLedStore((s) => s.setBrightness);
  const setGamma = useLedStore((s) => s.setGamma);
  const setChannelOrder = useLedStore((s) => s.setChannelOrder);
  const setWiring = useLedStore((s) => s.setWiring);
  const setOrigin = useLedStore((s) => s.setOrigin);
  const setPayloadMode = useLedStore((s) => s.setPayloadMode);
  const setRunMode = useLedStore((s) => s.setRunMode);

  const ip = useLedStore((s) => s.ip);
  const status = useLedStore((s) => s.status);
  const error = useLedStore((s) => s.error);
  const autoSend = useLedStore((s) => s.autoSend);
  const setIp = useLedStore((s) => s.setIp);
  const setAutoSend = useLedStore((s) => s.setAutoSend);
  const connect = useLedStore((s) => s.connect);
  const disconnect = useLedStore((s) => s.disconnect);
  const sendNow = useLedStore((s) => s.sendNow);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawLedMatrix(canvas, matrix, matrixCols, matrixRows);
  }, [matrix, matrixCols, matrixRows]);

  return {
    canvasRef,
    cols: geo.led_cols,
    rows: geo.led_rows,
    brightness,
    gamma,
    channelOrder,
    wiring,
    origin,
    payloadMode,
    runMode,
    setBrightness,
    setGamma,
    setChannelOrder,
    setWiring,
    setOrigin,
    setPayloadMode,
    setRunMode,
    ip,
    status,
    error,
    autoSend,
    connected: status === 'connected',
    setIp,
    setAutoSend,
    connect,
    disconnect,
    sendNow,
  };
}
