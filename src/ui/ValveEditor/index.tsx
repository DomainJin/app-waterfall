import { ValveControls } from './ValveControls';
import { ValveGridCanvas } from './ValveGridCanvas';
import { useValveEditor } from './useValveEditor';
import './styles.css';

// Phase 5: valve grid editor — live source overlay + threshold + manual paint,
// Grid/Smooth timing modes, and byte-exact .bin export. Thin composition;
// logic lives in useValveEditor. No <form>.
export function ValveEditor() {
  const {
    canvasRef,
    cols,
    valveRows,
    currentRow,
    threshold,
    mode,
    exporting,
    status,
    setThreshold,
    setMode,
    clearPaint,
    paintCol,
    exportBin,
  } = useValveEditor();

  return (
    <section className="panel" data-panel="valve-editor">
      <h2 className="panel__title">
        Valve editor
        <span className="valve-editor__meta">
          {cols} cols · row {currentRow + 1}/{valveRows}
        </span>
      </h2>

      <ValveGridCanvas canvasRef={canvasRef} cols={cols} onPaintCol={paintCol} />

      <ValveControls
        threshold={threshold}
        mode={mode}
        exporting={exporting}
        status={status}
        onThreshold={setThreshold}
        onMode={setMode}
        onClearPaint={clearPaint}
        onExport={exportBin}
      />
    </section>
  );
}
