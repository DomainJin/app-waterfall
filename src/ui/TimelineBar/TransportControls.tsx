interface TransportControlsProps {
  isPlaying: boolean;
  onToggle: () => void;
  onStop: () => void;
  onStep: (direction: number) => void;
}

// The four transport buttons: prev frame / play-pause / stop / next frame.
export function TransportControls({
  isPlaying,
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
