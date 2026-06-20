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

**Phase 6 (preview window) complete.** The 2nd Electron window renders the valve layer as
**falling water** at physical scale: each active valve emits a stream at its physical x,
falling with gravity (`core/preview/water.ts`, pure + tested). The preview is a separate
renderer with no `<video>` element, so the main window runs the LIVE per-row pipeline
(`sampleValveRow`: frameAt → threshold → maskEdges, combined with paint — the same single-
frame probe the valve editor uses) and streams it **row by row** over IPC as the timeline
advances or is scrubbed, into a sparse `rowIndex → bits` cache in the preview; it is never
a pre-baked whole-grid snapshot, so the curtain tracks actual video playback frame by
frame. Consecutive open rows naturally render as one continuous flowing streak; a single
open row renders as one falling droplet; closed bursts trail off as a detached slug that
exits after `FALL_DURATION_MS`. Meter ruler + ms readout, edge-margin shown disabled (water
only in the active band), valve layer toggle (LED in Phase 8). The preview's render loop
(rAF) is fully decoupled from React.

**Phase 5 + firmware sync complete.** `codec/valveBin/` (pure, byte-exact to
CAU_TRUC_DU_LIEU.md + firmware handoff): `packFrame` (4 + B, LE ts), `valveBits`
(MSB-first, dynamic B), `packConfigFrame` (6-byte `[FD FF FF FF][valve_count u16 LE]`),
`buildAnimationGrid`/`buildAnimationSmooth` (**CONFIG → RESET → START → data → sentinel** —
CONFIG first so firmware learns valve_count before parsing any frame).
`core/layers/valve/` (pure): `sampleFrameToGrid`, `thresholdGrid`, `applyPaint`,
`gridToRows`/`gridToEvents`, `frameToValveRow`/`maskEdges` (edge-margin), `buildValveBin`.
`ValveEditor`: source overlay + threshold + manual paint, Grid/Smooth modes, byte-exact
`.bin` export. **edge_margin** (app-side, symmetric): edge valves forced off and the video
compressed 100% into the active middle band `[margin, valve_cols−margin)`; `valve_cols`,
the `.bin`, and `valve_count` are unchanged. Geometry exposes `active_cols` + `marginValid`.

**Transport / firmware sync:** `transport/` — JSON command builders (dynamic-length
`SET` hex, `SET_TICK`, `GET_CONFIG`, `ALL_OFF/ON`, `STREAM_STOP`; no `SET_MODE`),
`/version` poll (read-direction tick floor), minimal `ValveSocket`. `store/device` +
`DevicePanel`: connect ws://ip:3333, device tick floor enforced on `row_interval_ms`,
`effective_tick = max(tickMs, row_interval_ms)`, two-way `SET_TICK` sync. Unit-tested
(codec, valve layer, transport).

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
