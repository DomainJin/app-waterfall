import { useUiStore } from '../../store/uiStore';
import { DevicePanel } from '../DevicePanel';
import { PhysicalConfig } from '../PhysicalConfig';
import { SourcePanel } from '../SourcePanel';
import { TimelineBar } from '../TimelineBar';
import { ValveEditor } from '../ValveEditor';
import { useOpenPreview } from './useOpenPreview';
import './styles.css';

// Main window shell. Thin composition — the preview-open logic lives in
// useOpenPreview; each panel owns its own state.
export function App() {
  const previewOpenCount = useUiStore((s) => s.previewOpenCount);
  const openPreview = useOpenPreview();

  return (
    <div className="app">
      <header className="app__header">
        <h1>Waterfall Designer</h1>
        <span className="app__phase">Phase 5 — valve + .bin (firmware sync)</span>
      </header>

      <TimelineBar />

      <main className="app__body">
        <PhysicalConfig />
        <DevicePanel />
        <SourcePanel />
        <ValveEditor />

        <button type="button" className="btn" onClick={openPreview}>
          Open preview window
        </button>

        <p className="app__hint">
          Preview windows opened this session: {previewOpenCount}
        </p>
      </main>
    </div>
  );
}
