import { LedControls } from './LedControls';
import { LedStripCanvas } from './LedStripCanvas';
import { useLedEditor } from './useLedEditor';
import './styles.css';

// LED strip editor — the LED is a single ceiling-mounted strip shining down
// (LED_ACTUAL_SPEC.md), NOT a 2D matrix. Its colors are pre-computed for
// the whole timeline from the valve grid (LED_MODE_SPEC.md, no video
// sampling) by useLedScriptCompute; this panel shows the CURRENT row plus
// Normal/Focus/Fade/Mix-Color mode, a base color, fade speed / palette
// (mode-specific), brightness/gamma, and channel order/wiring/origin/
// payload/run mode for the IC9803 wire-format. No connection controls here
// — LED streams over the shared valve+LED socket (see DevicePanel). Thin
// composition; logic lives in useLedEditor.
export function LedEditor() {
  const {
    canvasRef,
    cols,
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
  } = useLedEditor();

  return (
    <section className="panel" data-panel="led-editor">
      <h2 className="panel__title">
        LED editor
        <span className="led-editor__meta">
          {cols} cols (1 strip) · script: {scriptRows} rows
        </span>
      </h2>

      <LedStripCanvas canvasRef={canvasRef} />

      <LedControls
        brightness={brightness}
        gamma={gamma}
        mode={mode}
        baseColor={baseColor}
        fadeSpeed={fadeSpeed}
        paletteName={paletteName}
        channelOrder={channelOrder}
        wiring={wiring}
        origin={origin}
        payloadMode={payloadMode}
        runMode={runMode}
        exporting={exporting}
        status={status}
        onBrightness={setBrightness}
        onGamma={setGamma}
        onMode={setMode}
        onBaseColor={setBaseColor}
        onFadeSpeed={setFadeSpeed}
        onPaletteName={setPaletteName}
        onChannelOrder={setChannelOrder}
        onWiring={setWiring}
        onOrigin={setOrigin}
        onPayloadMode={setPayloadMode}
        onRunMode={setRunMode}
        onExport={exportScript}
      />
    </section>
  );
}
