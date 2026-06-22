import { useUiStore } from '../../store/uiStore';
import { AudioEditor } from '../AudioEditor';
import { DevicePanel } from '../DevicePanel';
import { LedEditor } from '../LedEditor';
import { PhysicalConfig } from '../PhysicalConfig';
import { ProjectMenu } from '../ProjectMenu';
import { SourcePanel } from '../SourcePanel';
import { TimelineBar } from '../TimelineBar';
import { ValveEditor } from '../ValveEditor';
import { useAudioPlaybackSync } from './useAudioPlaybackSync';
import { useAudioWaveformCompute } from './useAudioWaveformCompute';
import { useDocumentTitle } from './useDocumentTitle';
import { useExportAll } from './useExportAll';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useLedScriptCompute } from './useLedScriptCompute';
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
  // Pre-computes the whole LED script from the valve grid (LED_MODE_SPEC.md).
  useLedScriptCompute();
  // Pushes the finished valve grid + LED script + transport to the preview window over IPC.
  const { previewReady } = usePreviewSync();
  // Pre-computes the waveform for the bound audio source (visualization only).
  useAudioWaveformCompute();
  // Drives a dedicated <audio> element off the master clock + offset.
  useAudioPlaybackSync();
  const { exportAll, exporting: exportingAll, status: exportAllStatus, ready: exportAllReady } = useExportAll();
  // Space = play/pause, Home = seek to 0 (skipped while typing in a text field).
  useKeyboardShortcuts();
  // Window title mirrors the currently open project file.
  useDocumentTitle();

  return (
    <div className="app">
      <header className="app__header">
        <h1>Waterfall Designer</h1>
        <ProjectMenu />
        <span className="app__phase">Phase 9 — Audio layer</span>
      </header>

      <TimelineBar />

      <main className="app__body">
        <PhysicalConfig />
        <DevicePanel />
        <SourcePanel />
        <ValveEditor />
        <LedEditor />
        <AudioEditor />

        <button type="button" className="btn" onClick={openPreview}>
          Open preview window
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => void exportAll()}
          disabled={exportingAll || !exportAllReady}
          title="Export valve .bin + LED script together — one folder (Electron) or two downloads (browser)"
        >
          {exportingAll ? 'Exporting…' : 'Export All'}
        </button>
        {exportAllStatus && <span className="app__export-status">{exportAllStatus}</span>}

        <p className="app__hint">
          Preview windows opened this session: {previewOpenCount}
          {previewReady && ' · preview connected'}
        </p>
      </main>
    </div>
  );
}
