// Fixed physical densities and config defaults for curtain geometry.
// INVARIANT: never hardcode valve/LED counts — they derive from these.

/** Fixed physical densities. */
export const VALVES_PER_METER = 40; // 1 valve every 2.5 cm
export const LEDS_PER_METER = 10; //  1 LED every 10 cm

/** Default temporal resolution (ultra-smooth). Real ESP32-SPI-limited values
 *  are supplied by the user later. */
export const DEFAULT_ROW_INTERVAL_MS = 16;

/** Default LED matrix height (vertical pixels). User-configurable. */
export const DEFAULT_LED_ROWS = 8;

/** Default curtain height (m). User-configurable. */
export const DEFAULT_CURTAIN_HEIGHT_M = 2.0;

/** Standard gravity (m/s²). */
export const GRAVITY_M_S2 = 9.81;
