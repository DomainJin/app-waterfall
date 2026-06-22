import { useEffect, useRef } from 'react';
import { AudioPlayer } from '../../core/audio';
import { useAudioStore } from '../../store/audio';
import { useSourceStore } from '../../store/source';
import { useTimelineStore } from '../../store/timeline';

// Drives a dedicated <audio> element (AudioPlayer) from the master clock —
// play/pause/seek mirror the timeline exactly, shifted by the user's offset.
// Subscribes to the clock directly (fires ~60/s while playing) instead of
// re-rendering React, same pattern as usePreviewSync's transport push.
export function useAudioPlaybackSync() {
  const setHasAudioTrack = useAudioStore((s) => s.setHasAudioTrack);
  const playerRef = useRef<AudioPlayer | null>(null);
  // setHasAudioTrack is a stable Zustand action reference — safe to close
  // over once here, same as the player instance itself.
  if (!playerRef.current) playerRef.current = new AudioPlayer(undefined, setHasAudioTrack);

  const resolvedUrl = useSourceStore((s) => s.resolvedUrl('audio'));
  const offsetMs = useAudioStore((s) => s.offsetMs);
  const volume = useAudioStore((s) => s.volume);

  useEffect(() => {
    playerRef.current!.setSource(resolvedUrl);
  }, [resolvedUrl]);

  useEffect(() => {
    playerRef.current!.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    const player = playerRef.current!;
    const sync = () => {
      const t = useTimelineStore.getState();
      player.sync(t.positionMs, t.isPlaying, offsetMs);
    };
    sync();
    return useTimelineStore.subscribe(sync);
  }, [offsetMs]);

  useEffect(() => () => playerRef.current?.dispose(), []);
}
