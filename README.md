# Waterfall Designer

Desktop app (Electron + Vite + React + TypeScript, Zustand state) for programming a
physical waterfall curtain display — per-pixel **valve** layer (`.bin`), **IC9803 LED**
matrix layer, and synced **audio** — all driven by video off one master timeline.
Resolutions derive from the curtain length in meters (40 valves/m, 10 LEDs/m).

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server + Electron (main window; button opens preview window) |
| `npm run build` | Type-check (`tsc --noEmit`) + build renderer to `dist/` |
| `npm test` | Run vitest once |
| `npm run test:watch` | Vitest in watch mode |

## Status

**Phase 5 (valve layer + .bin codec) complete.** `codec/valveBin/` (pure, byte-exact to
CAU_TRUC_DU_LIEU.md): `packFrame` (4 + B, LE ts), `valveBits` (MSB-first, dynamic B),
`buildAnimationGrid` and `buildAnimationSmooth` (RESET → START → data → all-off sentinel).
`core/layers/valve/` (pure): area-average `sampleFrameToGrid`, `thresholdGrid`,
`applyPaint`, `gridToRows`/`gridToEvents`, and `buildValveBin` (source frames → .bin).
`ValveEditor`: live source overlay + threshold + manual paint, Grid/Smooth modes, and
byte-exact `.bin` export. Unit-tested (codec + layer).

Earlier: **Phase 4 (video source + binding)** — `VideoSource` decodes frames via hidden
`<video>` + canvas; `SourceBinding` (pure) resolves each layer to master or its own file
behind a uniform `frameAt`. Sources panel + per-layer dropdown + frame probe.
**Phase 3 (master timeline)** — `MasterClock` ms clock, rAF loop decoupled from
React, transport + scrub + fps + duration, top `TimelineBar`. **Phase 2 (physical
config)** — pure `computeGeometry` (8 m → 320 / 80 / 40), live readout. **Phase 1
(scaffold)** — Electron shell, IPC second window, Zustand, vitest, folder tree.
Layer pipelines and byte-exact codecs come later.

## Layout

- `electron/` — main process (`main.js`) + `preload.js` (IPC bridge)
- `src/core/` — physical geometry, timeline, sources, layers (pure, no UI imports)
- `src/codec/` — `valveBin.ts`, `ic9803.ts` (pure, unit-tested, byte-exact to specs)
- `src/transport/` — WebSocket to ESP32 (valve :3333, LED :3334)
- `src/store/` — Zustand stores
- `src/ui/` — React components per panel
- `tests/` — vitest

Hardware specs: `CAU_TRUC_DU_LIEU.md` (valve `.bin`), `ic6803_protocol.md` (IC9803 pixel).
The previous single-file prototype is kept as `legacy_prototype.html`.
