import { AudioControls } from './AudioControls';
import { WaveformCanvas } from './WaveformCanvas';
import { useAudioEditor } from './useAudioEditor';
import './styles.css';

// Audio layer: synced playback only, no feature extraction. Audio comes
// from the shared master/own source binding (see SourcePanel — the "Audio"
// row), same as valve/LED. Playback itself is driven by
// useAudioPlaybackSync (mounted at the App level) directly off the master
// clock; this panel just shows the pre-computed waveform + an offset slider
// to nudge audio relative to the visual. Thin composition; logic lives in
// useAudioEditor.
const STATUS_LABEL: Record<string, (durationS: string) => string> = {
  ok: (durationS) => `${durationS}s`,
  unsupported: () => 'audio loaded ✓ (waveform unavailable)',
  none: () => 'no audio',
};

export function AudioEditor() {
  const { canvasRef, offsetMs, volume, waveformDurationMs, status, setOffsetMs, setVolume } = useAudioEditor();

  return (
    <section className="panel" data-panel="audio-editor">
      <h2 className="panel__title">
        Audio editor
        <span className="audio-editor__meta">
          {STATUS_LABEL[status]((waveformDurationMs / 1000).toFixed(1))}
        </span>
      </h2>

      <WaveformCanvas canvasRef={canvasRef} />

      <AudioControls offsetMs={offsetMs} volume={volume} onOffsetMs={setOffsetMs} onVolume={setVolume} />
    </section>
  );
}
