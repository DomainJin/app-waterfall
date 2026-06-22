import { useEffect, useRef } from 'react';
import { audioStatus, targetAudioSec } from '../../core/audio';
import { useAudioStore } from '../../store/audio';
import { useTimelineStore } from '../../store/timeline';
import { drawWaveform } from './draw';

// All state/effects for the audio editor. The component just renders.
// Playback itself is driven by useAudioPlaybackSync (mounted once at the
// App level); this hook only redraws the waveform + playhead. It subscribes
// to the clock directly (fires ~60/s while playing) instead of through a
// React-rerendering selector, same render-loop-outside-React pattern as the
// LED/valve canvases.
export function useAudioEditor() {
  const waveform = useAudioStore((s) => s.waveform);
  const waveformDurationMs = useAudioStore((s) => s.waveformDurationMs);
  const hasAudioTrack = useAudioStore((s) => s.hasAudioTrack);
  const offsetMs = useAudioStore((s) => s.offsetMs);
  const volume = useAudioStore((s) => s.volume);
  const setOffsetMs = useAudioStore((s) => s.setOffsetMs);
  const setVolume = useAudioStore((s) => s.setVolume);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const status = audioStatus(hasAudioTrack, waveformDurationMs);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const redraw = () => {
      const positionMs = useTimelineStore.getState().positionMs;
      drawWaveform(canvas, waveform, waveformDurationMs, targetAudioSec(positionMs, offsetMs), status);
    };
    redraw();
    return useTimelineStore.subscribe(redraw);
  }, [waveform, waveformDurationMs, offsetMs, status]);

  return {
    canvasRef,
    offsetMs,
    volume,
    waveformDurationMs,
    status,
    setOffsetMs,
    setVolume,
  };
}
