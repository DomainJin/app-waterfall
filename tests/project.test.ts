import { describe, expect, it } from 'vitest';
import { ChannelOrder, Origin, Wiring } from '../src/codec/ic9803';
import { PROJECT_FILE_VERSION, type ProjectSnapshotInputs } from '../src/core/project';
import { ProjectFileError, parseProjectFile } from '../src/core/project/deserialize';
import { buildProjectFile, serializeProjectFile } from '../src/core/project/serialize';

function makeInputs(): ProjectSnapshotInputs {
  return {
    physical: {
      length_m: 8,
      row_interval_ms: 16,
      fixedFrameBytes: null,
      valveIndexBase: 0,
      edge_margin: 0,
      curtain_height_m: 2,
    },
    device: { ip: '192.168.1.222', wsPort: 3333, httpPort: 8080 },
    valve: {
      threshold: 0.5,
      invert: false,
      flipH: false,
      flipV: false,
      mode: 'grid',
      paint: { 5: true, 12: false },
    },
    led: {
      brightness: 255,
      gamma: 1,
      mode: 'normal',
      baseColor: { r: 255, g: 255, b: 255 },
      fadeSpeed: 6,
      paletteName: 'rainbow',
      channelOrder: ChannelOrder.RGB,
      wiring: Wiring.LINEAR,
      origin: Origin.TOP_LEFT,
      payloadMode: 'rgb888',
      runMode: 'live',
    },
    audio: { offsetMs: 0, volume: 1 },
    sources: {
      master: { name: 'sunset.mp4', path: 'D:/videos/sunset.mp4' },
      bindings: {
        valve: { kind: 'master', own: null },
        led: { kind: 'own', own: { name: 'leds.mp4', path: 'D:/videos/leds.mp4' } },
        audio: { kind: 'master', own: null },
      },
    },
  };
}

describe('buildProjectFile / serializeProjectFile', () => {
  it('stamps the current version and a timestamp', () => {
    const file = buildProjectFile(makeInputs());
    expect(file.version).toBe(PROJECT_FILE_VERSION);
    expect(() => new Date(file.savedAt).toISOString()).not.toThrow();
  });

  it('round-trips every section byte-for-byte through JSON', () => {
    const inputs = makeInputs();
    const json = serializeProjectFile(inputs);
    const parsed = parseProjectFile(json);
    expect(parsed.physical).toEqual(inputs.physical);
    expect(parsed.device).toEqual(inputs.device);
    expect(parsed.valve).toEqual(inputs.valve);
    expect(parsed.led).toEqual(inputs.led);
    expect(parsed.audio).toEqual(inputs.audio);
    expect(parsed.sources).toEqual(inputs.sources);
  });

  it('preserves numeric-keyed paint overrides (edge case: 0 is a valid index)', () => {
    const inputs = makeInputs();
    inputs.valve.paint = { 0: true, 1: false };
    const parsed = parseProjectFile(serializeProjectFile(inputs));
    expect(parsed.valve.paint).toEqual({ 0: true, 1: false });
  });

  it('preserves a null master/own path (browser session, no real fs path known)', () => {
    const inputs = makeInputs();
    inputs.sources.master = { name: 'sunset.mp4', path: null };
    const parsed = parseProjectFile(serializeProjectFile(inputs));
    expect(parsed.sources.master).toEqual({ name: 'sunset.mp4', path: null });
  });

  it('preserves "no master loaded" / "no own source" (null sections)', () => {
    const inputs = makeInputs();
    inputs.sources.master = null;
    inputs.sources.bindings.led = { kind: 'master', own: null };
    const parsed = parseProjectFile(serializeProjectFile(inputs));
    expect(parsed.sources.master).toBeNull();
    expect(parsed.sources.bindings.led).toEqual({ kind: 'master', own: null });
  });
});

describe('parseProjectFile — validation', () => {
  it('rejects malformed JSON', () => {
    expect(() => parseProjectFile('{not json')).toThrow(ProjectFileError);
  });

  it('rejects a non-object root (e.g. a bare array)', () => {
    expect(() => parseProjectFile('[1,2,3]')).toThrow(ProjectFileError);
  });

  it('rejects an unsupported version', () => {
    const file = buildProjectFile(makeInputs());
    const tampered = JSON.stringify({ ...file, version: 999 });
    expect(() => parseProjectFile(tampered)).toThrow(/version/i);
  });

  it('rejects a file missing a required section', () => {
    const file = buildProjectFile(makeInputs());
    const { led, ...rest } = file;
    expect(() => parseProjectFile(JSON.stringify(rest))).toThrow(/led/);
  });
});
