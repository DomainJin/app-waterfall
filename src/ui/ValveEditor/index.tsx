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
    invert,
    flipH,
    flipV,
    mode,
    exporting,
    computing,
    status,
    setThreshold,
    setInvert,
    setFlipH,
    setFlipV,
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
      <p className="valve-editor__hint">Click = paint 1 cell · Shift+click = paint whole column</p>

      <ValveControls
        threshold={threshold}
        invert={invert}
        flipH={flipH}
        flipV={flipV}
        mode={mode}
        exporting={exporting}
        computing={computing}
        status={status}
        onThreshold={setThreshold}
        onInvert={setInvert}
        onFlipH={setFlipH}
        onFlipV={setFlipV}
        onMode={setMode}
        onClearPaint={clearPaint}
        onExport={exportBin}
      />
    </section>
  );
}
