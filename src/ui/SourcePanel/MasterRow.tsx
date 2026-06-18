interface MasterRowProps {
  masterName: string | null;
  loading?: boolean;
  onLoad: () => void;
}

// The master video row: name + load/replace button.
export function MasterRow({ masterName, loading, onLoad }: MasterRowProps) {
  return (
    <div className="source-row">
      <span className="source-row__label">Master</span>
      <span className="source-row__name">{masterName ?? '—'}</span>
      <button
        type="button"
        className="btn btn--sm"
        onClick={onLoad}
        disabled={loading}
      >
        {loading ? 'Loading…' : masterName ? 'Replace…' : 'Load…'}
      </button>
    </div>
  );
}
