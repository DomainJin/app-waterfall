import { LAYER_IDS } from '../../store/source';
import { LayerRow } from './LayerRow';
import { MasterRow } from './MasterRow';
import { useSourcePanel } from './useSourcePanel';
import './styles.css';

// Phase 4: master video loader + per-layer "Source: Master ▼ | Load own…".
// Decoupling a layer is one dropdown change. The probe button demonstrates the
// invariant: master-bound layers read the same frame; a decoupled layer reads
// its own. No <form>. Thin composition — logic lives in useSourcePanel.
export function SourcePanel() {
  const {
    masterName,
    bindings,
    loading,
    error,
    probeNote,
    fileInputRef,
    onFileChosen,
    pickFile,
    onLayerSelect,
    setThumbRef,
    probeFrames,
  } = useSourcePanel();

  return (
    <section className="panel" data-panel="source">
      <h2 className="panel__title">Sources</h2>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={onFileChosen}
      />

      <MasterRow
        masterName={masterName}
        loading={loading.master}
        onLoad={() => pickFile('master')}
      />

      <div className="source-layers">
        {LAYER_IDS.map((layer) => (
          <LayerRow
            key={layer}
            layer={layer}
            view={bindings[layer]}
            loading={loading[layer]}
            onSelect={(value) => onLayerSelect(layer, value)}
            thumbRef={setThumbRef(layer)}
          />
        ))}
      </div>

      <div className="source-footer">
        <button type="button" className="btn btn--sm" onClick={probeFrames}>
          Probe frames @ t
        </button>
        {probeNote && <span className="source-footer__note">{probeNote}</span>}
      </div>

      {error && <p className="source-error">{error}</p>}
    </section>
  );
}
