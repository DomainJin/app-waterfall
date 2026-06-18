import { useRef, useState } from 'react';
import { useTimelineStore } from '../../store/timeline';
import { LAYER_IDS, useSourceStore, type LayerId } from '../../store/source';
import { drawThumb } from './drawThumb';

// All state/handlers for the Sources panel. The component just renders.
export function useSourcePanel() {
  const masterName = useSourceStore((s) => s.masterName);
  const bindings = useSourceStore((s) => s.bindings);
  const loading = useSourceStore((s) => s.loading);
  const error = useSourceStore((s) => s.error);
  const loadMaster = useSourceStore((s) => s.loadMaster);
  const loadOwn = useSourceStore((s) => s.loadOwn);
  const useMaster = useSourceStore((s) => s.useMaster);
  const useOwn = useSourceStore((s) => s.useOwn);
  const frameAt = useSourceStore((s) => s.frameAt);

  const positionMs = useTimelineStore((s) => s.positionMs);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTarget = useRef<LayerId | 'master' | null>(null);
  const thumbRefs = useRef<Record<LayerId, HTMLCanvasElement | null>>({
    valve: null,
    led: null,
    audio: null,
  });
  const [probeNote, setProbeNote] = useState<string>('');

  function pickFile(target: LayerId | 'master') {
    pendingTarget.current = target;
    fileInputRef.current?.click();
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const target = pendingTarget.current;
    e.target.value = ''; // allow re-selecting the same file
    pendingTarget.current = null;
    if (!file || !target) return;
    if (target === 'master') void loadMaster(file);
    else void loadOwn(target, file);
  }

  function onLayerSelect(layer: LayerId, value: string) {
    if (value === 'master') useMaster(layer);
    else if (value === 'own') useOwn(layer);
    else if (value === 'load') pickFile(layer);
  }

  const setThumbRef = (layer: LayerId) => (el: HTMLCanvasElement | null) => {
    thumbRefs.current[layer] = el;
  };

  async function probeFrames() {
    setProbeNote('');
    let any = false;
    await Promise.all(
      LAYER_IDS.map(async (layer) => {
        const canvas = thumbRefs.current[layer];
        if (!canvas) return;
        try {
          const img = await frameAt(layer, positionMs);
          if (img) {
            drawThumb(canvas, img);
            any = true;
          } else {
            canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
          }
        } catch {
          canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
        }
      }),
    );
    setProbeNote(
      any
        ? `Probed at ${Math.round(positionMs)} ms`
        : 'No source loaded — load a master video first.',
    );
  }

  return {
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
  };
}
