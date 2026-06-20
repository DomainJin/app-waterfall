import { describe, expect, it } from 'vitest';
import {
  FALL_DURATION_MS,
  fallSpeed,
  fallY,
  isValveOpen,
  visibleRowRange,
} from '../src/core/preview';

describe('fallY (quadratic gravity)', () => {
  it('starts at the top, reaches the bottom at fallDuration', () => {
    expect(fallY(0, 1000)).toBe(0);
    expect(fallY(FALL_DURATION_MS, 1000)).toBeCloseTo(1000, 5);
  });

  it('is monotonic and accelerating (later half covers more than first half)', () => {
    const H = 1000;
    const firstHalf = fallY(FALL_DURATION_MS / 2, H);
    const full = fallY(FALL_DURATION_MS, H);
    expect(firstHalf).toBeGreaterThan(0);
    expect(firstHalf).toBeLessThan(full / 2); // quadratic -> < linear midpoint
  });

  it('clamps out-of-range ages', () => {
    expect(fallY(-100, 1000)).toBe(0);
    expect(fallY(99999, 1000)).toBe(1000);
  });
});

describe('fallSpeed', () => {
  it('is 0 at release and positive while falling', () => {
    expect(fallSpeed(0, 1000)).toBe(0);
    expect(fallSpeed(FALL_DURATION_MS / 2, 1000)).toBeGreaterThan(0);
  });
});

describe('visibleRowRange', () => {
  it('includes only rows whose water has not yet fallen off', () => {
    // T=1000ms, row_ms=100, fallDuration=1600 -> rows with t in [-600,1000]
    // clamped to [0, floor(1000/100)=10]
    const { r0, r1 } = visibleRowRange(1000, 100, 50, 1600);
    expect(r0).toBe(0);
    expect(r1).toBe(10);
  });

  it('drops rows older than fallDuration', () => {
    // T=5000, fallDuration=1600 -> oldest visible t = 3400 -> r0=34;
    // r1 = floor(5000/100)=50 (within rows=100).
    const { r0, r1 } = visibleRowRange(5000, 100, 100, 1600);
    expect(r0).toBe(34);
    expect(r1).toBe(50);
  });

  it('returns an empty range when nothing is visible', () => {
    // T far past the end (rows=5, max t=400, age >> fallDuration) -> r0 > r1.
    const empty = visibleRowRange(10_000, 100, 5, 1600);
    expect(empty.r1).toBeLessThan(empty.r0);
    // row_ms<=0 guard
    const guard = visibleRowRange(0, 0, 10);
    expect(guard.r1).toBeLessThan(guard.r0);
  });
});

describe('isValveOpen', () => {
  it('reads a flat rows×cols grid', () => {
    // 3 cols × 2 rows; row1 has valve 2 open
    const grid = new Uint8Array([0, 0, 0, 0, 0, 1]);
    expect(isValveOpen(grid, 1, 2, 3)).toBe(true);
    expect(isValveOpen(grid, 0, 2, 3)).toBe(false);
  });
});
