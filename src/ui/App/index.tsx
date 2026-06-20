import { useUiStore } from '../../store/uiStore';
import { DevicePanel } from '../DevicePanel';
import { LedEditor } from '../LedEditor';
import { PhysicalConfig } from '../PhysicalConfig';
import { SourcePanel } from '../SourcePanel';
import { TimelineBar } from '../TimelineBar';
import { ValveEditor } from '../ValveEditor';
import { useLedGridCompute } from './useLedGridCompute';
import { useOpenPreview } from './useOpenPreview';
import { usePreviewSync } from './usePreviewSync';
import { useValveGridCompute } from './useValveGridCompute';
import './styles.css';

// Main window shell. Thin composition — the preview-open logic lives in
// useOpenPreview; each panel owns its own state.
export function App() {
  const previewOpenCount = useUiStore((s) => s.previewOpenCount);
  const openPreview = useOpenPreview();
  // Pre-computes the whole valve grid up front (geometry/threshold/paint/source).
  useValveGridCompute();
  // Keeps the LED matrix sampled live as the playhead moves (no precompute).
  useLedGridCompute();
  // Pushes the finished grid + LED matrix + transport to the preview window over IPC.
  const { previewReady } = usePreviewSync();

  return (
    <div className="app">
      <header className="app__header">
        <h1>Waterfall Designer</h1>
        <span className="app__phase">Phase 8 — LED layer</span>
      </header>

      <TimelineBar />

      <main className="app__body">
        <PhysicalConfig />
        <DevicePanel />
        <SourcePanel />
        <ValveEditor />
        <LedEditor />

        <button type="button" className="btn" onClick={openPreview}>
          Open preview window
        </button>

        <p className="app__hint">
          Preview windows opened this session: {previewOpenCount}
          {previewReady && ' · preview connected'}
        </p>
      </main>
    </div>
  );
}
