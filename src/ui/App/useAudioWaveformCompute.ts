import { useEffect, useRef } from 'react';
import { decodeWaveform } from '../../core/audio';
import { useAudioStore } from '../../store/audio';
import { useSourceStore } from '../../store/source';

const NUM_BUCKETS = 1000;
const DEBOUNCE_MS = 200;

// Pre-computes the waveform ONCE per bound source (debounced), same model as
// useValveGridCompute/useLedScriptCompute: a generation counter discards a
// decode superseded by a newer source switch, and the editor only ever
// reads the finished `waveform` array — no decoding during playback.
export function useAudioWaveformCompute() {
  const resolvedUrl = useSourceStore((s) => s.resolvedUrl('audio'));
  const setWaveform = useAudioStore((s) => s.setWaveform);

  const genRef = useRef(0);

  useEffect(() => {
    const gen = ++genRef.current;

    if (!resolvedUrl) {
      setWaveform(null, 0);
      return;
    }

    const timer = setTimeout(() => {
      void decodeWaveform(resolvedUrl, NUM_BUCKETS)
        .then(({ peaks, durationMs }) => {
          if (genRef.current !== gen) return; // superseded — discard
          setWaveform(peaks, durationMs);
        })
        .catch((err) => {
          console.warn('[audio] waveform decode failed', err);
          if (genRef.current === gen) setWaveform(null, 0);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [resolvedUrl, setWaveform]);
}
