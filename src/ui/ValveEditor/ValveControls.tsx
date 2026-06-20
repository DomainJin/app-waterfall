import type { ValveMode } from '../../core/layers/valve';

interface ValveControlsProps {
  threshold: number;
  invert: boolean;
  flipH: boolean;
  flipV: boolean;
  mode: ValveMode;
  exporting: boolean;
  /** The precomputed grid export reads is being (re)built — export disabled meanwhile. */
  computing: boolean;
  status: string;
  onThreshold: (t: number) => void;
  onInvert: (invert: boolean) => void;
  onFlipH: (flipH: boolean) => void;
  onFlipV: (flipV: boolean) => void;
  onMode: (m: ValveMode) => void;
  onClearPaint: () => void;
  onExport: () => void;
}

// Threshold slider + invert/flip toggles + timing-mode toggle + clear-paint + export .bin.
export function ValveControls({
  threshold,
  invert,
  flipH,
  flipV,
  mode,
  exporting,
  computing,
  status,
  onThreshold,
  onInvert,
  onFlipH,
  onFlipV,
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

      <label className="valve-controls__field" title="Dark shape on a light background -> the shape is water, not the background">
        <input
          type="checkbox"
          checked={invert}
          onChange={(e) => onInvert(e.target.checked)}
        />
        <span>Invert threshold</span>
      </label>

      <label className="valve-controls__field" title="Mirror left<->right on the curtain">
        <input
          type="checkbox"
          checked={flipH}
          onChange={(e) => onFlipH(e.target.checked)}
        />
        <span>Flip horizontal</span>
      </label>

      <label className="valve-controls__field" title="Scan bottom-to-top instead of top-to-bottom">
        <input
          type="checkbox"
          checked={flipV}
          onChange={(e) => onFlipV(e.target.checked)}
        />
        <span>Flip vertical</span>
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
        disabled={exporting || computing}
      >
        {exporting ? 'Exporting…' : computing ? 'Computing…' : 'Export .bin'}
      </button>

      {status && <span className="valve-controls__status">{status}</span>}
    </div>
  );
}
