interface TransportControlsProps {
  isPlaying: boolean;
  /** Disable just Play/Pause — e.g. while the valve grid is being precomputed. */
  playDisabled?: boolean;
  onToggle: () => void;
  onStop: () => void;
  onStep: (direction: number) => void;
}

// The four transport buttons: prev frame / play-pause / stop / next frame.
export function TransportControls({
  isPlaying,
  playDisabled,
  onToggle,
  onStop,
  onStep,
}: TransportControlsProps) {
  return (
    <div className="timeline__transport">
      <button
        type="button"
        className="btn btn--icon"
        onClick={() => onStep(-1)}
        title="Previous frame"
      >
        ⏮
      </button>
      <button
        type="button"
        className="btn btn--icon"
        onClick={onToggle}
        disabled={playDisabled}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button
        type="button"
        className="btn btn--icon"
        onClick={onStop}
        title="Stop"
      >
        ⏹
      </button>
      <button
        type="button"
        className="btn btn--icon"
        onClick={() => onStep(1)}
        title="Next frame"
      >
        ⏭
      </button>
    </div>
  );
}
