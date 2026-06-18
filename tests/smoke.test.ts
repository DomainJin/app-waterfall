import { describe, expect, it } from 'vitest';
import { VALVES_PER_METER, LEDS_PER_METER } from '../src/core/physical';

// Phase 1 placeholder so `npm test` exercises the runner. Real codec
// byte-exactness tests (valveBin, ic9803) arrive with their phases.
describe('scaffold smoke', () => {
  it('exposes fixed physical densities (not hardcoded counts)', () => {
    expect(VALVES_PER_METER).toBe(40);
    expect(LEDS_PER_METER).toBe(10);
  });
});
