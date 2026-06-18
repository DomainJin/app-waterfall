# 04 — PREVIEW WINDOW + UI LAYOUT

> Dán khi làm **Phase 6** (preview) và khi ráp UI tổng.

---

## A. Preview window (bắt buộc) — `ui/PreviewWindow/`

A dedicated **separate Electron window** (opened from the main window via the IPC path
built in Phase 1) that renders **valve water + LED matrix in ONE combined frame**, scaled
to true physical geometry (e.g. 8 m wide). It plays in sync with the master timeline —
play/pause/scrub in the main window drives the preview.

### What it renders
1. **Valve layer as falling water.** Each active valve column emits a water stream at its
   physical x-position (`x = col / valve_cols × width`). As the timeline advances, streams
   fall downward so the canvas over time looks like the real curtain (a valve open at row
   `r` means water released at `t = r × row_interval_ms`, falling down the panel). Use a
   simple particle/streak model — vertical streaks with gravity, not just static dots.
2. **LED matrix overlaid** at correct physical scale and position. `led_cols` LEDs across,
   spaced 10 cm; `led_rows` stacked. Configurable y-offset (typically a strip above or
   behind the curtain). Render each LED as a glowing dot with its current RGB (after
   channel-order + brightness), sized to physical spacing.
3. **Physical ruler** in meters along the top, and a **current time readout in ms**.

### Sync requirements
- Reads the same master timeline + the same `source.frameAt(t)` pipeline as the layers —
  the preview must match what would actually be sent to hardware (WYSIWYG).
- Scrubbing seeks; playing animates in real time at the configured frame rate.
- Toggle layers on/off in preview (show valve only / LED only / both).

### Technical
- Canvas or WebGL (prefer canvas2D first for simplicity; WebGL only if perf needs it).
- Decouple render loop from React render — use `requestAnimationFrame` reading timeline
  state, not React re-renders per frame.

---

## B. Main window UI layout

```
┌──────────────────────────────────────────────────────────────────┐
│ TOP BAR                                                            │
│  [Length: __ m] → valve_cols=320  led_cols=80  bytes/frame=40      │
│  ◄◄  ▶/⏸  ■   [timeline scrubber ──────●────────]   t = 1234 ms    │
│  [Open Preview ⧉]                                                  │
├───────────┬──────────────────────────────────┬───────────────────┤
│ LEFT       │ CENTER (tabs)                     │ RIGHT             │
│ Sources    │ ┌ Valve │ LED │ Audio ┐          │ Layer settings    │
│ • Master   │ │                      │          │ • threshold       │
│   [load]   │ │  active editor       │          │ • row_interval_ms │
│ • Valve    │ │                      │          │ • led_rows        │
│   src ▼     │ │                      │          │ • channel order   │
│ • LED      │ │                      │          │ • wiring/origin   │
│   src ▼     │ │                      │          │ • audio offset    │
│ • Audio    │ └──────────────────────┘          │ ─────────────     │
│   src ▼     │                                   │ Export / Connect  │
│            │                                   │ • valve IP :3333  │
│            │                                   │ • led IP   :3334  │
│            │                                   │ • [Export .bin]   │
│            │                                   │ • [Connect][Send] │
│            │                                   │ • status: ●       │
└───────────┴──────────────────────────────────┴───────────────────┘
```

### Panels
- **Top bar:** Physical Config (length → live computed readout), master transport
  (play/pause/stop), timeline scrubber, ms readout, Open Preview button.
- **Left — Sources:** master video loader + per-layer source dropdown
  ("Master ▼ | Load own…"). Decoupling a layer is one dropdown change.
- **Center — tabbed editors:** Valve grid / LED matrix / Audio waveform, all reflecting
  current `t`.
- **Right — settings + connect:** per-layer settings; export `.bin`; separate IP fields
  for valve ESP32 (:3333) and LED ESP32 (:3334); connect/disconnect; live status.

### Control panels (transport §)
- JSON text commands from the valve spec (`ALL_OFF`, `ALL_ON`, `STREAM_STOP`, `SET`,
  `SET_MODE`, …) as buttons in a valve control panel.
- LED control: brightness slider (sends BRIGHTNESS frame), all-off, live-preview toggle.

### State (Zustand stores)
- `useTimelineStore` — t, playing, duration, fps.
- `useGeometryStore` — length_m, derived cols/leds/bytes, row_interval_ms.
- `useSourceStore` — master video + per-layer bindings.
- `useLayerStore` — per-layer settings (threshold, led_rows, order, offset…).
- `useConnectionStore` — valve/led IP, socket status.
