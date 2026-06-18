# 01 — MASTER PROMPT

> Dán nguyên khối này đầu tiên vào Claude Code. Đính kèm sẵn 2 file:
> `CAU_TRUC_DU_LIEU.md` và `ic6803_protocol.md`.

---

Build a **desktop application** called **Waterfall Designer** — a tool for programming a
physical waterfall curtain display with synchronized RGB LED matrix, driven by video.

Stack: **Electron + React + Vite + TypeScript**, state via **Zustand**, no `<form>` tags,
functional components only. All binary codecs must be **pure and unit-tested**, fully
decoupled from UI.

I've attached two hardware spec files — **read both before writing code**:
- `CAU_TRUC_DU_LIEU.md` — valve `.bin` binary format. Your output must be byte-exact.
- `ic6803_protocol.md` — the LED IC (referred to as **IC9803**, same 16-bit/pixel family
  as 6803/LPD6803). Pixel encoding must match.

I will provide additional detailed spec files for physical geometry, the LED wire-format,
preview, and a phased build order in subsequent messages. **For now: understand the
architecture below and complete Phase 1 (scaffold) only.**

## Core concept

The user enters the **curtain length in meters**. The app auto-derives all layer
resolutions from fixed physical densities and re-renders everything on change. A **master
timeline** (millisecond clock) drives **three layers**, each with its **own video source**
but able to share one **master video**.

```
                 ┌──────── MASTER TIMELINE (ms) ────────┐
                 │   play / pause / scrub — drives all    │
                 └───────────────────────────────────────┘
        ┌────────────────┬───────────────────┬────────────────┐
   ┌────▼────┐     ┌─────▼─────┐       ┌──────▼──────┐
   │ VALVE   │     │   LED     │       │   AUDIO     │
   │ (primary)│     │ (IC9803   │       │ (synced     │
   │ per-pixel│     │  matrix)  │       │  playback)  │
   │ → .bin   │     │ per-pixel │       │             │
   └────┬─────┘     └─────┬─────┘       └─────────────┘
        │                 │
   [ESP32 :3333]     [ESP32 :3334]
        └────────┬────────┘
            ┌────▼─────┐
            │ PREVIEW  │  valve water + LED in one physical-scale frame
            └──────────┘
```

## The three layers

**VALVE (primary, per-pixel):** video → `valve_cols × valve_rows` grid → adjustable
threshold → boolean on/off → export `.bin` byte-exact to `CAU_TRUC_DU_LIEU.md`. Column
count is **dynamic from length** (40 valves/m). Rows = temporal resolution set by
`row_interval_ms` (configurable; default ultra-fine). Detailed spec comes in file `02`.

**LED (per-pixel, IC9803 2D matrix):** video → downsample to `led_rows × led_cols` RGB →
encode per IC9803 (16-bit/pixel) → stream over a custom wire-format to a **separate ESP32**.
10 LEDs/m. Detailed wire-format spec comes in file `03`.

**AUDIO (synced playback only):** audio from master/layer video or a separate file,
played in sync with the master timeline. No feature extraction. Waveform + offset slider.

## Source binding (key abstraction)

`SourceBinding`: a master video is loaded once; each layer's source is `"master"` or its
own loaded file (dropdown "Source: Master ▼ | Load own…"). Every layer reads frames via
`source.frameAt(t_ms)`, so processing is **source-agnostic** — switching source never
changes the pipeline.

## Target project structure

```
waterfall-designer/
├── electron/
│   ├── main.js              # main window + preview window via IPC
│   └── preload.js
├── src/
│   ├── core/
│   │   ├── physical.ts       # length_m → cols/leds/bytes (spec file 02)
│   │   ├── timeline.ts       # master ms clock
│   │   ├── sources/
│   │   │   ├── VideoSource.ts
│   │   │   └── SourceBinding.ts
│   │   └── layers/
│   │       ├── ValveLayer.ts
│   │       ├── LedLayer.ts
│   │       └── AudioLayer.ts
│   ├── codec/
│   │   ├── valveBin.ts       # dynamic-byte valve .bin (spec file 02)
│   │   └── ic9803.ts         # LED wire-format (spec file 03)
│   ├── transport/
│   │   └── websocket.ts      # valve :3333, led :3334, chunked drain
│   ├── store/                # Zustand stores
│   └── ui/
│       ├── PhysicalConfig/
│       ├── SourcePanel/
│       ├── ValveEditor/
│       ├── LedEditor/
│       ├── AudioEditor/
│       ├── PreviewWindow/
│       └── TimelineBar/
└── tests/                    # codec unit tests
```

## Invariant rules (apply in EVERY phase)

1. **Never hardcode 80 valves or 10 bytes.** Everything derives from length.
2. Codecs are pure and unit-tested; no UI imports in `codec/` or `core/`.
3. Valve `.bin` byte-exact to `CAU_TRUC_DU_LIEU.md`; LED frames byte-exact to spec file 03.
4. All layers read frames via `source.frameAt(t_ms)`.
5. React functional components, Zustand, no `<form>`.

---

## ▶ PHASE 1 — do this now

Scaffold the project:
- Electron + Vite + React + TypeScript, runnable dev build, blank main window.
- IPC plumbing to **open a second window** (the future preview window) from the main
  window — just an empty window for now, proving the IPC path works.
- Set up Zustand, a `tests/` folder with a test runner (vitest), and the empty folder
  structure above with placeholder files where helpful.
- Add npm scripts: `dev`, `build`, `test`.

Confirm: `npm run dev` opens the main window, a button opens a blank second window, and
`npm test` runs (even with zero tests). Stop after Phase 1 and report what you built.
Do NOT start other layers yet — I'll send the next spec files.
