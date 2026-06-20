import { useEffect, useRef } from 'react';
import { computeFullGrid } from '../../core/layers/valve';
import { useGeometry } from '../../store/physical';
import { useSourceStore } from '../../store/source';
import { useTimelineStore } from '../../store/timeline';
import { useValveStore } from '../../store/valve';

const DEBOUNCE_MS = 250;

// Pre-computes the ENTIRE valve grid up front whenever anything that changes
// its content changes (geometry, threshold, paint, source). Playback, the
// preview, and .bin export then only ever READ the resulting array — no
// video seeking happens during playback at all, which is what made the old
// live-sampling pipeline stall and made replay depend on seek speed.
//
// A generation counter discards superseded computes (e.g. the user drags the
// threshold slider while a compute is mid-flight) and flushes the source's
// queued-but-not-started seeks so the next compute isn't stuck behind them.
export function useValveGridCompute() {
  const geo = useGeometry();
  const durationMs = useTimelineStore((s) => s.durationMs);
  const threshold = useValveStore((s) => s.threshold);
  const invert = useValveStore((s) => s.invert);
  const flipH = useValveStore((s) => s.flipH);
  const flipV = useValveStore((s) => s.flipV);
  const paint = useValveStore((s) => s.paint);
  const frameAtStore = useSourceStore((s) => s.frameAt);
  const flushPendingStore = useSourceStore((s) => s.flushPending);
  const masterName = useSourceStore((s) => s.masterName);
  const valveBinding = useSourceStore((s) => s.bindings.valve);

  const genRef = useRef(0);

  useEffect(() => {
    const gen = ++genRef.current;
    const cols = geo.valve_cols;
    const row_ms = geo.row_interval_ms;
    const rows = Math.max(1, Math.ceil(durationMs / row_ms));
    const { setComputing, setProgress, setGridResult } = useValveStore.getState();

    if (durationMs <= 0) {
      // No video loaded yet — an all-off grid is trivially "ready", not "computing".
      setGridResult(new Uint8Array(cols * rows), rows, cols);
      setComputing(false);
      setProgress(1);
      return;
    }

    setComputing(true);
    setProgress(0);

    const timer = setTimeout(() => {
      void computeFullGrid({
        frameAt: (t) => frameAtStore('valve', t),
        cols,
        rows,
        row_ms,
        threshold,
        invert,
        flip_h: flipH,
        flip_v: flipV,
        visible_rows: geo.visible_rows,
        paint,
        edge_margin: geo.edge_margin,
        onProgress: (fraction) => {
          if (genRef.current === gen) useValveStore.getState().setProgress(fraction);
        },
        isCancelled: () => genRef.current !== gen,
      })
        .then((grid) => {
          if (genRef.current !== gen) return; // superseded — discard
          setGridResult(grid, rows, cols);
          setComputing(false);
          setProgress(1);
        })
        .catch((err) => {
          console.warn('[valve] grid compute failed', err);
          if (genRef.current === gen) setComputing(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      flushPendingStore('valve');
    };
  }, [
    geo.valve_cols,
    geo.row_interval_ms,
    geo.edge_margin,
    geo.visible_rows,
    durationMs,
    threshold,
    invert,
    flipH,
    flipV,
    paint,
    masterName,
    valveBinding.kind,
    valveBinding.ownName,
    frameAtStore,
    flushPendingStore,
  ]);
}
