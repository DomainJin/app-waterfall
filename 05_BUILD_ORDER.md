# 05 — BUILD ORDER (9 phases)

> Dùng xuyên suốt. Mỗi phase: làm xong → chứng minh "Done" → mới sang phase sau.
> Kèm file spec tương ứng ở cột "Spec".

| Phase | Nội dung | Spec kèm | Done khi |
|---|---|---|---|
| 1 | Scaffold | `01` | `npm run dev` mở main window; nút mở window thứ 2; `npm test` chạy |
| 2 | Physical config | `02-A` | Nhập mét → hiện đúng valve_cols/led_cols/bytes, re-render live |
| 3 | Master timeline | `01` | Clock ms + transport play/pause/scrub + ms readout hoạt động |
| 4 | Video source + binding | `01` | Load video, `frameAt(t)` trả frame đúng; per-layer source dropdown |
| 5 | Valve layer + .bin | `02-B,C` | Grid+threshold; export .bin byte-exact; **unit test pass** |
| 6 | Preview window | `04-A` | Valve water streams + ruler, sync timeline |
| 7 | Transport valve | `01`,valve spec | Connect :3333, chunked send tôn trọng queue 512, JSON cmds |
| 8 | LED layer | `03` | Matrix downsample + ic9803 encode + send :3334 + LED vào preview |
| 9 | Audio layer | `01` | Waveform + playback sync + offset slider |

---

## Chi tiết từng phase

### Phase 1 — Scaffold
Electron+Vite+React+TS chạy được; IPC mở window thứ 2 (preview tương lai); Zustand +
vitest + cấu trúc thư mục. Scripts `dev/build/test`.
**Done:** dev mở window, nút mở window 2, test chạy (kể cả 0 test).

### Phase 2 — Physical config
`core/physical.ts` thuần + panel nhập length_m. Live readout valve_cols, led_cols,
valve_bytes_per_frame. Flags: `row_interval_ms`, `fixedFrameBytes`, `valveIndexBase`.
**Done:** đổi mét → mọi số tính lại đúng (8m→320/80/40), re-render.

### Phase 3 — Master timeline
`core/timeline.ts` clock ms + `useTimelineStore`. Transport play/pause/stop/scrub, fps,
duration, ms readout ở top bar. Render loop tách khỏi React (rAF).
**Done:** play chạy thời gian thực, scrub seek, đọc ms chính xác.

### Phase 4 — Video source + binding
`VideoSource` (load video, decode qua `<video>`+canvas, `frameAt(t_ms)` trả ImageData),
`SourceBinding` (master vs per-layer). Source panel + dropdown mỗi layer.
**Done:** load 1 video master, 3 layer đọc cùng frame; load video riêng cho 1 layer →
layer đó decouple, 2 layer kia vẫn master.

### Phase 5 — Valve layer + .bin codec
`codec/valveBin.ts` (dynamic byte) + `ValveLayer.ts` + valve editor (grid, threshold,
manual paint, live overlay). Grid mode + Smooth mode.
**Done:** unit test pass (frame size 4+B, count, LE ts, bit packing, dynamic B gồm width
không chia hết 8, RESET/START/sentinel). Export ra file .bin tải được.

### Phase 6 — Preview window
`ui/PreviewWindow` mở ở window 2. Valve water streams theo physical x, rơi theo thời gian;
ruler mét; ms readout; sync master timeline; toggle layer.
**Done:** play → thấy nước rơi đúng cột đang mở, scrub seek đúng.

### Phase 7 — Transport valve
`transport/websocket.ts`: connect ws://IP:3333 binary; chunked send (RESET+START một lần,
chunk ~400 frame, `sleep(chunk×row_ms×0.8)` tôn trọng queue 512); JSON command panel
(ALL_OFF/ALL_ON/STREAM_STOP/SET/SET_MODE). Status indicator.
**Done:** gửi .bin tới ESP32 (hoặc mock ws server) không tràn queue; JSON cmd gửi được.

### Phase 8 — LED layer
`codec/ic9803.ts` (header 12B, RGB888/PACKED16, RESET/START/CONFIG/DATA/SENTINEL/
BRIGHTNESS, channel order) + `LedLayer.ts` (matrix downsample) + editor + send ws :3334 +
thêm LED vào preview frame. Unit test decode header/LE/flags/bpp.
**Done:** LED test pass; matrix preview + send tới ESP32 LED riêng; LED hiện trong preview.

### Phase 9 — Audio layer
`AudioLayer.ts`: audio từ master/layer video hoặc file riêng; waveform; playback sync
master timeline; offset slider. Scrub timeline → scrub audio.
**Done:** play → nhạc chạy khớp timeline; offset chỉnh lệch được; scrub kéo theo audio.

---

## Sau Phase 9 — polish
- Scrub mượt cả 3 layer + preview cùng lúc.
- Lưu/mở project (length, sources path, settings, painted overrides) ra JSON.
- Export đồng thời valve .bin + (tùy chọn) dump LED stream ra file.
- Error states: video lỗi, socket rớt, queue tràn.

## Nhắc lại quy tắc bất biến (mọi phase)
- KHÔNG hardcode 80 valve / 10 byte — suy từ length.
- Codec pure + unit-tested, không import UI.
- Valve .bin byte-exact `CAU_TRUC_DU_LIEU.md`; LED byte-exact file `03`.
- Mọi layer đọc qua `source.frameAt(t_ms)`.
- React functional, Zustand, KHÔNG `<form>`.
