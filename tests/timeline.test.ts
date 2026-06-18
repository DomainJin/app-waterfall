import { describe, expect, it } from 'vitest';
import { formatMs, MasterClock } from '../src/core/timeline';

// Controllable time source so advancement is deterministic without rAF.
let fakeNow = 0;
const now = () => fakeNow;

function clock(durationMs = 0, fps = 30) {
  fakeNow = 0;
  return new MasterClock({ durationMs, fps, now });
}

describe('MasterClock — initial state', () => {
  it('starts at 0, paused', () => {
    const c = clock(10_000);
    expect(c.positionMs).toBe(0);
    expect(c.isPlaying).toBe(false);
    expect(c.durationMs).toBe(10_000);
  });
});

describe('MasterClock — playback advancement', () => {
  it('advances by real elapsed time × rate', () => {
    const c = clock(10_000);
    c.play();
    fakeNow = 16;
    c.tick();
    expect(c.positionMs).toBeCloseTo(16, 6);
    fakeNow = 100;
    c.tick();
    expect(c.positionMs).toBeCloseTo(100, 6);
  });

  it('rate scales advancement', () => {
    const c = clock(10_000);
    c.setRate(2);
    c.play();
    fakeNow = 50;
    c.tick();
    expect(c.positionMs).toBeCloseTo(100, 6);
  });

  it('paused clock does not advance', () => {
    const c = clock(10_000);
    c.play();
    fakeNow = 20;
    c.tick();
    c.pause();
    fakeNow = 500;
    c.tick();
    expect(c.positionMs).toBeCloseTo(20, 6);
  });
});

describe('MasterClock — transport', () => {
  it('stop resets to 0 and pauses', () => {
    const c = clock(10_000);
    c.play();
    fakeNow = 300;
    c.tick();
    c.stop();
    expect(c.positionMs).toBe(0);
    expect(c.isPlaying).toBe(false);
  });

  it('toggle flips play/pause', () => {
    const c = clock(10_000);
    c.toggle();
    expect(c.isPlaying).toBe(true);
    c.toggle();
    expect(c.isPlaying).toBe(false);
  });

  it('stops at duration and clamps position', () => {
    const c = clock(100);
    c.play();
    fakeNow = 250;
    c.tick();
    expect(c.positionMs).toBe(100);
    expect(c.isPlaying).toBe(false);
  });

  it('play from the end restarts at 0', () => {
    const c = clock(100);
    c.seek(100);
    c.play();
    expect(c.positionMs).toBe(0);
    expect(c.isPlaying).toBe(true);
  });
});

describe('MasterClock — seek & step', () => {
  it('seek clamps to [0, duration]', () => {
    const c = clock(1000);
    c.seek(500);
    expect(c.positionMs).toBe(500);
    c.seek(-100);
    expect(c.positionMs).toBe(0);
    c.seek(99_999);
    expect(c.positionMs).toBe(1000);
  });

  it('seek while playing does not cause a jump on next tick', () => {
    const c = clock(10_000);
    c.play();
    fakeNow = 1000;
    c.tick(); // pos = 1000
    c.seek(2000); // resets lastNow to fakeNow (1000)
    fakeNow = 1100;
    c.tick();
    expect(c.positionMs).toBeCloseTo(2100, 6); // 2000 + 100, not +1100
  });

  it('stepFrame moves by 1000/fps ms', () => {
    const c = clock(10_000, 25); // 40 ms/frame
    c.stepFrame(1);
    expect(c.positionMs).toBeCloseTo(40, 6);
    c.stepFrame(-1);
    expect(c.positionMs).toBeCloseTo(0, 6);
  });
});

describe('MasterClock — config & subscription', () => {
  it('setDuration clamps an out-of-range position', () => {
    const c = clock(10_000);
    c.seek(8000);
    c.setDuration(5000);
    expect(c.positionMs).toBe(5000);
  });

  it('notifies subscribers with a snapshot', () => {
    const c = clock(10_000);
    const seen: number[] = [];
    const unsub = c.subscribe((s) => seen.push(s.positionMs));
    c.seek(123);
    expect(seen.at(-1)).toBe(123);
    unsub();
    c.seek(456);
    expect(seen.at(-1)).toBe(123); // no longer notified
  });
});

describe('formatMs', () => {
  it('formats mm:ss.mmm', () => {
    expect(formatMs(0)).toBe('00:00.000');
    expect(formatMs(1500)).toBe('00:01.500');
    expect(formatMs(61_234)).toBe('01:01.234');
    expect(formatMs(-5)).toBe('00:00.000');
  });
});
