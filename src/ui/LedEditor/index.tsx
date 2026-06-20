import { LedControls } from './LedControls';
import { LedMatrixCanvas } from './LedMatrixCanvas';
import { useLedEditor } from './useLedEditor';
import './styles.css';

// Phase 8: LED matrix editor — live RGB downsample of the video (kept fresh
// by useLedGridCompute), brightness/gamma, channel order/wiring/origin, and
// payload/run mode for the IC9803 wire-format. Thin composition; logic
// lives in useLedEditor.
export function LedEditor() {
  const {
    canvasRef,
    cols,
    rows,
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
    connected,
    setIp,
    setAutoSend,
    connect,
    disconnect,
    sendNow,
  } = useLedEditor();

  return (
    <section className="panel" data-panel="led-editor">
      <h2 className="panel__title">
        LED editor
        <span className="led-editor__meta">
          {cols} cols × {rows} rows
        </span>
      </h2>

      <LedMatrixCanvas canvasRef={canvasRef} />

      <LedControls
        brightness={brightness}
        gamma={gamma}
        channelOrder={channelOrder}
        wiring={wiring}
        origin={origin}
        payloadMode={payloadMode}
        runMode={runMode}
        onBrightness={setBrightness}
        onGamma={setGamma}
        onChannelOrder={setChannelOrder}
        onWiring={setWiring}
        onOrigin={setOrigin}
        onPayloadMode={setPayloadMode}
        onRunMode={setRunMode}
        ip={ip}
        status={status}
        error={error}
        autoSend={autoSend}
        connected={connected}
        onIp={setIp}
        onAutoSend={setAutoSend}
        onConnect={() => void connect()}
        onDisconnect={disconnect}
        onSendNow={sendNow}
      />
    </section>
  );
}
