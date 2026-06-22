// LED layer color utilities — RGB type, brightness/gamma post-processing,
// wire-format flattening, and the Mix Color preset palettes. PURE, no
// video/valve-grid logic (see script.ts for that).

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export const BLACK: RGB = { r: 0, g: 0, b: 0 };

/**
 * Brightness (0-255, 255 = identity multiplier) and gamma (1 = identity,
 * >1 darkens midtones, <1 brightens them) correction, applied per channel.
 */
export function applyBrightnessGamma(c: RGB, brightness: number, gamma: number): RGB {
  const scale = Math.max(0, brightness) / 255;
  const g = gamma > 0 ? gamma : 1;
  const adjust = (v: number) => {
    const normalized = Math.max(0, Math.min(1, v / 255));
    return Math.max(0, Math.min(255, Math.round(255 * Math.pow(normalized, g) * scale)));
  };
  return { r: adjust(c.r), g: adjust(c.g), b: adjust(c.b) };
}

/** Flatten an RGB[] strip into a row-major Uint8Array (R,G,B per cell) — the
 *  wire shape used for the preview IPC message and the codec's pixel packers. */
export function flattenRgb(strip: RGB[]): Uint8Array {
  const out = new Uint8Array(strip.length * 3);
  for (let i = 0; i < strip.length; i++) {
    out[i * 3] = strip[i].r;
    out[i * 3 + 1] = strip[i].g;
    out[i * 3 + 2] = strip[i].b;
  }
  return out;
}

/** Preset palettes for MIX_COLOR mode (LED_MODE_SPEC.md §UI: "preset hoặc
 *  custom... Mặc định: rainbow 6 màu"). */
export const PALETTES = {
  rainbow: [
    { r: 255, g: 0, b: 0 },
    { r: 255, g: 140, b: 0 },
    { r: 255, g: 230, b: 0 },
    { r: 0, g: 200, b: 0 },
    { r: 0, g: 120, b: 255 },
    { r: 160, g: 0, b: 220 },
  ],
  warm: [
    { r: 255, g: 60, b: 0 },
    { r: 255, g: 140, b: 0 },
    { r: 255, g: 200, b: 0 },
    { r: 255, g: 0, b: 90 },
    { r: 255, g: 0, b: 180 },
    { r: 200, g: 30, b: 0 },
  ],
  cool: [
    { r: 0, g: 200, b: 255 },
    { r: 0, g: 120, b: 255 },
    { r: 0, g: 220, b: 180 },
    { r: 80, g: 0, b: 220 },
    { r: 0, g: 80, b: 160 },
    { r: 120, g: 0, b: 255 },
  ],
} as const satisfies Record<string, readonly RGB[]>;

export type PaletteName = keyof typeof PALETTES;
