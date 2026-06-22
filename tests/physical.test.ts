import { describe, expect, it } from 'vitest';
import {
  computeGeometry,
  DEFAULT_CURTAIN_HEIGHT_M,
  DEFAULT_ROW_INTERVAL_MS,
  GRAVITY_M_S2,
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

describe('computeGeometry — edge_margin', () => {
  it('default 0: active_cols = valve_cols, valid', () => {
    const g = computeGeometry(8);
    expect(g.edge_margin).toBe(0);
    expect(g.active_cols).toBe(320);
    expect(g.marginValid).toBe(true);
  });

  it('margin shrinks active_cols but NOT valve_cols / bytes', () => {
    const g = computeGeometry(8, { edge_margin: 10 });
    expect(g.valve_cols).toBe(320); // unchanged
    expect(g.valve_bytes_per_frame).toBe(40); // unchanged (.bin unaffected)
    expect(g.active_cols).toBe(300); // 320 - 2×10
    expect(g.marginValid).toBe(true);
  });

  it('invalid when 2×margin >= valve_cols', () => {
    const g = computeGeometry(2, { edge_margin: 40 }); // valve_cols 80, 2×40=80
    expect(g.marginValid).toBe(false);
    expect(g.active_cols).toBe(0);
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

describe('computeGeometry — curtain_height_m / fall physics', () => {
  it('defaults to DEFAULT_CURTAIN_HEIGHT_M (2.0 m)', () => {
    const g = computeGeometry(8);
    expect(g.curtain_height_m).toBe(DEFAULT_CURTAIN_HEIGHT_M);
  });

  it('spec example: 2.0 m, row_interval 16ms -> fall_time 639ms, visible_rows 39, frame_duration 624ms', () => {
    const g = computeGeometry(8, { curtain_height_m: 2.0, row_interval_ms: 16 });
    expect(g.fall_time_ms).toBeCloseTo(638.6, 1);
    expect(Math.round(g.fall_time_ms)).toBe(639);
    expect(g.visible_rows).toBe(39);
    expect(g.frame_duration_ms).toBe(624);
  });

  it('fall_time_ms matches the free-fall formula t = sqrt(2h/g)', () => {
    const h = 3.5;
    const g = computeGeometry(8, { curtain_height_m: h });
    expect(g.fall_time_ms).toBeCloseTo(Math.sqrt((2 * h) / GRAVITY_M_S2) * 1000, 6);
  });

  it('taller curtain -> longer fall_time and more visible_rows', () => {
    const low = computeGeometry(8, { curtain_height_m: 1, row_interval_ms: 16 });
    const high = computeGeometry(8, { curtain_height_m: 4, row_interval_ms: 16 });
    expect(high.fall_time_ms).toBeGreaterThan(low.fall_time_ms);
    expect(high.visible_rows).toBeGreaterThan(low.visible_rows);
  });

  it('frame_duration_ms = visible_rows × row_interval_ms (snapped to whole rows)', () => {
    const g = computeGeometry(8, { curtain_height_m: 2.0, row_interval_ms: 16 });
    expect(g.frame_duration_ms).toBe(g.visible_rows * g.row_interval_ms);
  });

  it('invalid curtain_height_m (0/negative/NaN) falls back to default', () => {
    for (const bad of [0, -1, NaN]) {
      expect(computeGeometry(8, { curtain_height_m: bad }).curtain_height_m).toBe(
        DEFAULT_CURTAIN_HEIGHT_M,
      );
    }
  });
});
