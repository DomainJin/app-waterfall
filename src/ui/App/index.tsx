import { type CSSProperties, type PointerEvent as ReactPointerEvent, useRef, useState } from 'react';
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
import { useValveGridCompute } from './useValveGridCompute';
import { InlinePreview } from './InlinePreview';
import './styles.css';

// Main window shell. Each panel keeps its own state; this component only
// composes the commercial workspace layout.
export function App() {
  const [physicalOpen, setPhysicalOpen] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [rightRailWidth, setRightRailWidth] = useState(330);
  const resizeStartRef = useRef({ x: 0, width: 330 });
  const leftRailCollapsed = !physicalOpen && !sourcesOpen;
  useValveGridCompute();
  useLedScriptCompute();
  useAudioWaveformCompute();
  useAudioPlaybackSync();
  const { exportAll, exporting: exportingAll, status: exportAllStatus, ready: exportAllReady } = useExportAll();
  useKeyboardShortcuts();
  useDocumentTitle();

  const appBodyStyle = {
    '--right-rail-width': `${rightRailWidth}px`,
  } as CSSProperties;

  const startRightRailResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    resizeStartRef.current = { x: event.clientX, width: rightRailWidth };
    document.body.classList.add('is-resizing-right-rail');

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = resizeStartRef.current.x - moveEvent.clientX;
      const maxWidth = Math.min(560, Math.max(330, window.innerWidth - 760));
      const nextWidth = Math.min(maxWidth, Math.max(280, resizeStartRef.current.width + delta));
      setRightRailWidth(nextWidth);
    };

    const onPointerUp = () => {
      document.body.classList.remove('is-resizing-right-rail');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="app">
      <div className="app__topbar">
        <header className="app__header">
          <h1>Waterfall Designer</h1>
          <ProjectMenu />
          <span className="app__phase">Phase 9 - Audio layer</span>
        </header>

        <TimelineBar />
      </div>

      <main
        className={`app__body ${leftRailCollapsed ? 'app__body--left-collapsed' : ''}`}
        style={appBodyStyle}
      >
        <aside className="app__rail app__rail--left">
          <div className="app__rail-section">
            <button
              type="button"
              className={`app__rail-toggle ${physicalOpen ? 'app__rail-toggle--active' : ''}`}
              onClick={() => setPhysicalOpen((open) => !open)}
              aria-expanded={physicalOpen}
              title={physicalOpen ? 'Hide Physical config' : 'Show Physical config'}
            >
              <span className="app__rail-toggle-icon">{physicalOpen ? '<' : '>'}</span>
              <span className="app__rail-toggle-text">Physical</span>
            </button>

            {physicalOpen && (
              <div className="app__rail-content">
                <PhysicalConfig />
              </div>
            )}
          </div>

          <div className="app__rail-section">
            <button
              type="button"
              className={`app__rail-toggle ${sourcesOpen ? 'app__rail-toggle--active' : ''}`}
              onClick={() => setSourcesOpen((open) => !open)}
              aria-expanded={sourcesOpen}
              title={sourcesOpen ? 'Hide Sources' : 'Show Sources'}
            >
              <span className="app__rail-toggle-icon">{sourcesOpen ? '<' : '>'}</span>
              <span className="app__rail-toggle-text">Sources</span>
            </button>

            {sourcesOpen && (
              <div className="app__rail-content">
                <SourcePanel />
              </div>
            )}
          </div>
        </aside>

        <section className="app__stage" aria-label="Editors">
          <ValveEditor />
          <LedEditor />
          <AudioEditor />
        </section>

        <aside className="app__rail app__rail--right">
          <button
            type="button"
            className="app__right-resizer"
            onPointerDown={startRightRailResize}
            aria-label="Resize right sidebar"
            title="Resize right sidebar"
          />

          <DevicePanel />

          <section className="panel app__actions" data-panel="actions">
            <h2 className="panel__title">Output</h2>

            <div className="app__action-buttons">
              <button
                type="button"
                className="btn"
                onClick={() => void exportAll()}
                disabled={exportingAll || !exportAllReady}
                title="Export valve .bin + LED script together - one folder (Electron) or two downloads (browser)"
              >
                {exportingAll ? 'Exporting...' : 'Export All'}
              </button>
            </div>

            {exportAllStatus && <span className="app__export-status">{exportAllStatus}</span>}
            <InlinePreview />
          </section>
        </aside>
      </main>
    </div>
  );
}
