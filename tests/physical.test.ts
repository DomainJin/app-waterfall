import { describe, expect, it } from 'vitest';
import {
  computeGeometry,
  DEFAULT_LED_ROWS,
  DEFAULT_ROW_INTERVAL_MS,
  LEDS_PER_METER,
  VALVES_PER_METER,
} from '../src/core/physical';

describe('computeGeometry — densities', () => {
  it('uses fixed densities (not hardcoded counts)', () => {
    expect(VALVES_PER_METER).toBe(40);
    expect(LEDS_PER_METER).toBe(10);
  });

  it('spec example: 8 m -> 320 valves / 80 LEDs / 40 bytes', () => {
    const g = computeGeometry(8);
    expect(g.valve_cols).toBe(320);
    expect(g.led_cols).toBe(80);
    expect(g.valve_bytes_per_frame).toBe(40);
  });

  it('2 m case (the original spec) -> 80 valves / 20 LEDs / 10 bytes', () => {
    const g = computeGeometry(2);
    expect(g.valve_cols).toBe(80);
    expect(g.led_cols).toBe(20);
    expect(g.valve_bytes_per_frame).toBe(10);
  });

  it('rounds valve_cols and led_cols', () => {
    // 1.23 m -> 49.2 -> 49 valves, 12.3 -> 12 LEDs
    const g = computeGeometry(1.23);
    expect(g.valve_cols).toBe(49);
    expect(g.led_cols).toBe(12);
  });
});

describe('computeGeometry — byte count', () => {
  it('non-multiple-of-8 width rounds bytes up (ceil)', () => {
    // 50 valves -> ceil(50/8) = 7 bytes (last byte partially used)
    const g = computeGeometry(1.25); // 1.25 * 40 = 50
    expect(g.valve_cols).toBe(50);
    expect(g.valve_bytes_per_frame).toBe(7);
  });

  it('fixedFrameBytes forces the byte count regardless of valve_cols', () => {
    const g = computeGeometry(8, { fixedFrameBytes: 10 });
    expect(g.valve_cols).toBe(320); // unchanged
    expect(g.valve_bytes_per_frame).toBe(10); // forced
    expect(g.fixedFrameBytes).toBe(10);
  });

  it('fixedFrameBytes OFF (null/0) derives from valve_cols', () => {
    expect(computeGeometry(8, { fixedFrameBytes: null }).valve_bytes_per_frame).toBe(40);
    expect(computeGeometry(8, { fixedFrameBytes: 0 }).valve_bytes_per_frame).toBe(40);
    expect(computeGeometry(8).fixedFrameBytes).toBeNull();
  });
});

describe('computeGeometry — options & defaults', () => {
  it('applies defaults', () => {
    const g = computeGeometry(8);
    expect(g.row_interval_ms).toBe(DEFAULT_ROW_INTERVAL_MS);
    expect(g.led_rows).toBe(DEFAULT_LED_ROWS);
    expect(g.valveIndexBase).toBe(0);
    expect(g.valve_rows).toBeNull();
  });

  it('valveIndexBase only accepts 0 or 1', () => {
    expect(computeGeometry(8, { valveIndexBase: 1 }).valveIndexBase).toBe(1);
    expect(computeGeometry(8, { valveIndexBase: 0 }).valveIndexBase).toBe(0);
  });

  it('derives valve_rows from duration / row_interval (ceil)', () => {
    const g = computeGeometry(8, { duration_ms: 1000, row_interval_ms: 16 });
    expect(g.row_interval_ms).toBe(16);
    expect(g.valve_rows).toBe(Math.ceil(1000 / 16)); // 63
  });

  it('invalid row_interval falls back to default', () => {
    expect(computeGeometry(8, { row_interval_ms: 0 }).row_interval_ms).toBe(
      DEFAULT_ROW_INTERVAL_MS,
    );
    expect(computeGeometry(8, { row_interval_ms: -5 }).row_interval_ms).toBe(
      DEFAULT_ROW_INTERVAL_MS,
    );
  });
});

describe('computeGeometry — edge cases', () => {
  it('zero / negative / NaN length -> all zeros', () => {
    for (const bad of [0, -3, NaN, Infinity]) {
      const g = computeGeometry(bad);
      expect(g.length_m).toBe(0);
      expect(g.valve_cols).toBe(0);
      expect(g.led_cols).toBe(0);
      expect(g.valve_bytes_per_frame).toBe(0);
    }
  });

  it('is pure — repeated calls give equal results', () => {
    expect(computeGeometry(5.5)).toEqual(computeGeometry(5.5));
  });
});
