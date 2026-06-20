import { usePreviewRenderer } from './usePreviewRenderer';
import './styles.css';

// Dedicated preview window (2nd Electron window, #preview route). Renders
// the valve layer as falling water at physical scale, and the LED layer as
// a live color strip above it (Phase 8) — both synced to the master
// timeline in the main window over IPC.
export function PreviewWindow() {
  const { canvasRef, valveOn, toggleValve, ledOn, toggleLed, connected } = usePreviewRenderer();

  return (
    <div className="preview">
      <div className="preview__toolbar">
        <span className="preview__title">Preview — valve water</span>
        <button
          type="button"
          className={`preview__toggle${valveOn ? ' is-on' : ''}`}
          onClick={toggleValve}
        >
          Valve {valveOn ? '✓' : '✗'}
        </button>
        <button
          type="button"
          className={`preview__toggle${ledOn ? ' is-on' : ''}`}
          onClick={toggleLed}
        >
          LED {ledOn ? '✓' : '✗'}
        </button>
        <span className="preview__conn">{connected ? '● synced' : '○ waiting'}</span>
      </div>
      <div className="preview__stage">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
