import type { LayerId } from '../../store/source';
import { LAYER_LABELS } from './constants';

interface BindingView {
  kind: 'master' | 'own';
  ownName: string | null;
}

interface LayerRowProps {
  layer: LayerId;
  view: BindingView;
  loading?: boolean;
  onSelect: (value: string) => void;
  thumbRef: (el: HTMLCanvasElement | null) => void;
}

// A single layer's source dropdown ("Master | <own> | Load own…") + thumbnail.
export function LayerRow({
  layer,
  view,
  loading,
  onSelect,
  thumbRef,
}: LayerRowProps) {
  const value = view.kind === 'own' ? 'own' : 'master';

  return (
    <div className="source-row">
      <span className="source-row__label">{LAYER_LABELS[layer]}</span>
      <select
        className="source-row__select"
        value={value}
        disabled={loading}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="master">Master</option>
        {view.ownName && <option value="own">{view.ownName}</option>}
        <option value="load">Load own…</option>
      </select>
      <canvas
        className="source-row__thumb"
        width={120}
        height={20}
        ref={thumbRef}
      />
    </div>
  );
}
