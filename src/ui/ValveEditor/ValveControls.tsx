import type { ValveMode } from '../../core/layers/valve';

interface ValveControlsProps {
  threshold: number;
  mode: ValveMode;
  exporting: boolean;
  status: string;
  onThreshold: (t: number) => void;
  onMode: (m: ValveMode) => void;
  onClearPaint: () => void;
  onExport: () => void;
}

// Threshold slider + timing-mode toggle + clear-paint + export .bin.
export function ValveControls({
  threshold,
  mode,
  exporting,
  status,
  onThreshold,
  onMode,
  onClearPaint,
  onExport,
}: ValveControlsProps) {
  return (
    <div className="valve-controls">
      <label className="valve-controls__field">
        <span>threshold {threshold.toFixed(2)}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={threshold}
          onChange={(e) => onThreshold(parseFloat(e.target.value))}
        />
      </label>

      <label className="valve-controls__field">
        <span>mode</span>
        <select value={mode} onChange={(e) => onMode(e.target.value as ValveMode)}>
          <option value="grid">Grid</option>
          <option value="smooth">Smooth</option>
        </select>
      </label>

      <button type="button" className="btn btn--sm" onClick={onClearPaint}>
        Clear paint
      </button>

      <button
        type="button"
        className="btn btn--sm"
        onClick={onExport}
        disabled={exporting}
      >
        {exporting ? 'Exporting…' : 'Export .bin'}
      </button>

      {status && <span className="valve-controls__status">{status}</span>}
    </div>
  );
}
