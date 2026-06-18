# 02 — PHYSICAL GEOMETRY + VALVE `.bin` SPEC

> Dán khi làm **Phase 2** (physical config) và **Phase 5** (valve codec).
> Đính kèm lại `CAU_TRUC_DU_LIEU.md` để đối chiếu byte-exact.

---

## A. Physical geometry — `core/physical.ts`

The user enters **total curtain length in meters**. Derive everything from fixed
densities. Re-render the whole app on any change.

| Quantity | Formula | Density | Example (8 m) |
|---|---|---|---|
| `valve_cols` | `round(length_m × 40)` | 40 valves/m (2.5 cm) | **320** |
| `led_cols` | `round(length_m × 10)` | 10 LEDs/m (10 cm) | **80** |
| `valve_bytes_per_frame` | `ceil(valve_cols / 8)` | — | 40 |
| `valve_rows` | derived from `row_interval_ms` × duration | — | depends |
| `led_rows` | user config (vertical matrix) | — | e.g. 8 |

Expose a pure function:
```ts
computeGeometry(length_m: number, opts): {
  valve_cols, led_cols, valve_bytes_per_frame, ...
}
```

**Config flags** (first-class settings):
- `row_interval_ms` — temporal resolution. Default a small "ultra-smooth" value (e.g. 16).
  User will supply real ESP32-SPI-limited values later.
- `fixedFrameBytes` (default OFF) — if firmware expects a fixed byte count regardless of
  `valve_cols`, force that byte count. Easy toggle. (Confirm with firmware which mode.)
- `valveIndexBase` — 0 or 1 indexed, kept consistent across code.

**Phase 2 UI deliverable:** a Physical Config panel: numeric length-in-meters input with
live readout of `valve_cols`, `led_cols`, `valve_bytes_per_frame`, and a re-render on
change. No video yet — just geometry math wired to UI.

---

## B. Valve `.bin` codec — `codec/valveBin.ts` (Phase 5)

Implement **exactly** per `CAU_TRUC_DU_LIEU.md`, but **generalized to dynamic column
count** (the spec's 80 valves / 10 bytes is just the 2 m case).

### Frame format (generalized)
```
┌──────────── 1 frame ────────────┐
│ ts_ms (u32 LE) │ bits[B] │       B = valve_bytes_per_frame = ceil(valve_cols/8)
└─────────────────────────────────┘   frame size = 4 + B bytes
```

### Bit packing — MSB first (unchanged from spec)
```ts
// valve v (0-indexed) ON:
buf[v >> 3] |= 1 << (7 - (v & 7));
```
bit 7 of byte 0 = first valve of each board. Same as spec; only the buffer length is
dynamic (`B` instead of fixed 10).

### Reserved timestamps (from spec)
| ts_ms | Meaning |
|---|---|
| `0xFFFFFFFF` | TS_RESET — clear queue, all valves off |
| `0xFFFFFFFE` | TS_START — start clock, scheduler runs |
| `0x00000000`–`0xFFFFFFFD` | normal data frame |

### Stream order (from spec)
```
RESET  →  START  →  data frames (ts ascending)  →  sentinel (bits=0, all off)
```

### Two timing modes
- **Grid mode:** `ts = row × row_interval_ms`, all valves in a row share the timestamp.
- **Smooth mode:** per-valve sub-frame timing (event list of open/close, sorted by ts,
  same-ts opens before closes), exactly like the spec's `build_smooth_diagonal`.

### Required exports (pure)
```ts
packFrame(ts_ms: number, bits: Uint8Array): Uint8Array       // 4 + B
valveBits(valves: number[], B: number): Uint8Array           // dynamic length
buildAnimationGrid(rows: number[][], row_ms, B): Uint8Array
buildAnimationSmooth(events, row_ms, B): Uint8Array
```

### Unit tests (Phase 5 done = these pass)
- Decode output: assert frame size = `4 + B`, frame count correct.
- ts_ms is Little-Endian (`A0 00 00 00` == 160).
- First/last/sentinel frames present (RESET, START, all-off end).
- Bit packing: valve 0 → `byte[0]=0x80`; valve 7 → `byte[0]=0x01`;
  valve 8 → `byte[1]=0x80`; last valve → correct byte/bit.
- Dynamic `B`: test with length 2 m (B=10), 8 m (B=40), and a non-multiple-of-8 width
  (e.g. 50 valves → B=7, last byte partially used) — assert unused trailing bits are 0.

---

## C. Valve layer — `core/layers/ValveLayer.ts` (Phase 5)

- Pull frame at `t` via `source.frameAt(t_ms)`.
- Sample video into `valve_cols × valve_rows` grid (area-average per cell).
- Apply threshold (adjustable slider) → boolean on/off.
- Feed into the codec to produce `.bin`.
- Manual paint override: user can paint/erase cells on top of (or instead of) the
  video-thresholded result.
- Live preview overlaying threshold result on the source video in the editor.
