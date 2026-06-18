import { describe, expect, it } from 'vitest';
import {
  IFrameSource,
  LAYER_IDS,
  SourceBinding,
  clampTimeMs,
} from '../src/core/sources';

// Mock frame source — frameAt returns a marker so we can assert which source
// produced the frame, without any DOM/video.
function mockSource(name: string): IFrameSource {
  return {
    name,
    durationMs: 1000,
    width: 10,
    height: 10,
    frameAt: async (t_ms) => ({ marker: name, t_ms }) as unknown as ImageData,
    dispose() {},
  };
}

async function markerOf(p: Promise<ImageData | null>): Promise<string | null> {
  const f = (await p) as unknown as { marker: string } | null;
  return f ? f.marker : null;
}

describe('SourceBinding — resolution', () => {
  it('defaults to master', async () => {
    const m = mockSource('master');
    const b = new SourceBinding(() => m);
    expect(b.kind).toBe('master');
    expect(b.isDecoupled).toBe(false);
    expect(b.resolve()).toBe(m);
    expect(await markerOf(b.frameAt(0))).toBe('master');
  });

  it('setOwn decouples and reads own', async () => {
    const m = mockSource('master');
    const own = mockSource('own');
    const b = new SourceBinding(() => m);
    b.setOwn(own);
    expect(b.kind).toBe('own');
    expect(b.isDecoupled).toBe(true);
    expect(await markerOf(b.frameAt(0))).toBe('own');
  });

  it('useMaster re-couples; useOwn restores own', async () => {
    const m = mockSource('master');
    const own = mockSource('own');
    const b = new SourceBinding(() => m);
    b.setOwn(own);
    b.useMaster();
    expect(await markerOf(b.frameAt(0))).toBe('master');
    expect(b.useOwn()).toBe(true);
    expect(await markerOf(b.frameAt(0))).toBe('own');
  });

  it('useOwn returns false when no own source loaded', () => {
    const b = new SourceBinding(() => mockSource('master'));
    expect(b.useOwn()).toBe(false);
    expect(b.kind).toBe('master');
  });

  it('frameAt returns null when nothing resolves', async () => {
    const b = new SourceBinding<IFrameSource>(() => null);
    expect(await b.frameAt(0)).toBeNull();
  });

  it('reads master lazily — reflects a later-loaded master', async () => {
    let m: IFrameSource | null = null;
    const b = new SourceBinding(() => m);
    expect(await b.frameAt(0)).toBeNull();
    m = mockSource('late-master');
    expect(await markerOf(b.frameAt(0))).toBe('late-master');
  });
});

describe('SourceBinding — Phase 4 "Done" scenario', () => {
  it('3 layers share master; decoupling one leaves the others on master', async () => {
    const master = mockSource('master');
    const getMaster = () => master;
    const layers = Object.fromEntries(
      LAYER_IDS.map((id) => [id, new SourceBinding(getMaster)]),
    ) as Record<(typeof LAYER_IDS)[number], SourceBinding>;

    // All three read the same master frame.
    for (const id of LAYER_IDS) {
      expect(await markerOf(layers[id].frameAt(100))).toBe('master');
    }

    // Decouple only the valve layer.
    layers.valve.setOwn(mockSource('valve-own'));

    expect(await markerOf(layers.valve.frameAt(100))).toBe('valve-own');
    expect(await markerOf(layers.led.frameAt(100))).toBe('master');
    expect(await markerOf(layers.audio.frameAt(100))).toBe('master');
  });
});

describe('clampTimeMs', () => {
  it('clamps into [0, duration]', () => {
    expect(clampTimeMs(-50, 1000)).toBe(0);
    expect(clampTimeMs(500, 1000)).toBe(500);
    expect(clampTimeMs(5000, 1000)).toBe(1000);
  });

  it('treats invalid time as 0; unbounded duration passes through', () => {
    expect(clampTimeMs(NaN, 1000)).toBe(0);
    expect(clampTimeMs(9999, 0)).toBe(9999); // duration 0 = unknown, no upper clamp
  });
});
