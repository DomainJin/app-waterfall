import { MAX_OFFSET_MS } from '../../store/audio';

interface AudioControlsProps {
  offsetMs: number;
  volume: number;
  onOffsetMs: (v: number) => void;
  onVolume: (v: number) => void;
}

export function AudioControls({ offsetMs, volume, onOffsetMs, onVolume }: AudioControlsProps) {
  return (
    <div className="audio-controls">
      <label
        className="audio-controls__field"
        title="Shift audio relative to the master timeline (ms). Positive = audio plays later than the visual."
      >
        <span>offset {offsetMs} ms</span>
        <input
          type="range"
          min={-MAX_OFFSET_MS}
          max={MAX_OFFSET_MS}
          step={10}
          value={offsetMs}
          onChange={(e) => onOffsetMs(parseInt(e.target.value, 10))}
        />
      </label>

      <label className="audio-controls__field" title="Playback volume for this app's audio element only — does not affect the exported files">
        <span>volume {Math.round(volume * 100)}%</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolume(parseFloat(e.target.value))}
        />
      </label>
    </div>
  );
}
