import { TimeReadout } from './TimeReadout';
import { TransportControls } from './TransportControls';
import { useTimelineBar } from './useTimelineBar';
import './styles.css';

// Phase 3: master timeline transport in the top bar. Thin composition —
// state in useTimelineBar, buttons/readout in sub-components.
export function TimelineBar() {
  const {
    positionMs,
    durationMs,
    isPlaying,
    fps,
    toggle,
    stop,
    seek,
    stepFrame,
    setDurationMs,
    setFps,
  } = useTimelineBar();

  return (
    <section className="timeline" data-panel="timeline">
      <TransportControls
        isPlaying={isPlaying}
        onToggle={toggle}
        onStop={stop}
        onStep={stepFrame}
      />

      <input
        className="timeline__scrub"
        type="range"
        min={0}
        max={Math.max(durationMs, 1)}
        step={1}
        value={Math.min(positionMs, durationMs)}
        onChange={(e) => seek(parseFloat(e.target.value))}
        aria-label="Scrub timeline"
      />

      <TimeReadout positionMs={positionMs} durationMs={durationMs} />

      <label className="timeline__field">
        <span>dur (s)</span>
        <input
          type="number"
          min={0}
          step={0.5}
          value={+(durationMs / 1000).toFixed(3)}
          onChange={(e) => setDurationMs(parseFloat(e.target.value) * 1000)}
        />
      </label>

      <label className="timeline__field">
        <span>fps</span>
        <input
          type="number"
          min={1}
          step={1}
          value={fps}
          onChange={(e) => setFps(parseInt(e.target.value, 10))}
        />
      </label>
    </section>
  );
}
