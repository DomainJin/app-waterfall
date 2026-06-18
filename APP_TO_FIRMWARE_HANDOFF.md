# APP → FIRMWARE — Tài liệu bàn giao (Stream/Control mode)

> File đầu vào cho Claude Code đang sửa **firmware Water Curtain**.
> App Electron **Waterfall Designer** thay thế hoàn toàn `control.html`.
> Mục đích app: **tạo file `.bin` nạp cho thẻ control** (+ gửi trực tiếp qua WebSocket 3333).
> Điểm CỐT LÕI phải nhớ: **SỐ VAN LÀ ĐỘNG** — không còn cố định 80 van / 10 board.

---

## 1. Thay đổi lớn nhất so với firmware cũ: số van động

Firmware cũ: `NUM_BOARDS = 10` cố định → frame `4 + 10 = 14` byte.

App mới: người dùng nhập **chiều dài màn (m)**, app tự tính:
```
valve_cols           = round(length_m × 40)      // 40 van/m, cách 2.5cm
valve_bytes_per_frame = ceil(valve_cols / 8)     // ĐỘNG
frame_size            = 4 + valve_bytes_per_frame
```

| Chiều dài | valve_cols | bytes/frame | frame_size |
|---|---|---|---|
| 2 m | 80 | 10 | 14 (= firmware cũ) |
| 8 m | 320 | 40 | 44 |
| 10 m | 400 | 50 | 54 |

→ Firmware **không được hardcode 10 byte**. Phải biết `valve_bytes_per_frame` để cắt frame đúng. Xem §2 cách firmware biết con số này.

> Lưu ý vật lý: mỗi byte = 8 van = 1 chip 74HC595. 320 van = 40 chip daisy-chain.
> SPI cứng (HSPI) đã có sẵn, chỉ cần shift đủ số byte động.

---

## 2. Làm sao firmware biết số byte mỗi frame? (2 phương án)

Frame binary không tự mô tả độ dài. Firmware phải biết `valve_bytes_per_frame`
**trước khi** parse stream. Chọn 1 trong 2:

### Phương án A — CONFIG frame đầu stream (khuyến nghị)

Thêm một frame điều khiển khai báo số van, gửi **ngay sau TS_RESET, trước TS_START**.
Tận dụng vùng `ts_ms` reserved (giống TS_RESET/TS_START đã có):

```
TS_CONFIG = 0xFFFFFFFD     // ts_ms reserved mới
Frame CONFIG (6 byte):
  [FD FF FF FF]  [valve_count: u16 LE]
   └ ts_ms ┘      └ vd 320 = 40 01 ┘
```

- Firmware đọc `valve_count` → tính `bytes = ceil(valve_count/8)` → set độ dài frame data.
- Sau CONFIG, mọi frame data dài đúng `4 + bytes`.
- Ưu: stream tự mô tả, file `.bin` chạy trên mọi cấu hình van mà không cần build lại firmware.

### Phương án B — biên dịch cứng theo phần cứng

Đặt `NUM_BOARDS` trong `config.h` khớp phần cứng thật (vd 40 cho 320 van), app gửi đúng
số byte đó, **không** gửi CONFIG. App có flag `fixedFrameBytes` để ép đúng số byte này.

- Ưu: không đổi protocol. Nhược: đổi số van phải sửa `config.h` + flash lại.
- Nếu chọn B: app và firmware phải **cùng** một con số, lệch là loạn frame.

> **Khuyến nghị A** vì đúng mục tiêu "file .bin nạp cho thẻ control" — file tự mô tả,
> không phụ thuộc firmware build sẵn. App nên **luôn** phát CONFIG frame; firmware cũ
> chưa hiểu CONFIG thì bỏ qua (forward-compatible) và dùng NUM_BOARDS mặc định.

---

## 3. Format file `.bin` app xuất ra (chuẩn nạp thẻ control)

Nối tiếp các frame, không header tổng, không padding:

```
┌──────────────────────────────────────────────┐
│ Frame 0 : TS_RESET   [FF FF FF FF | bits=0]   │  ← xóa queue, tắt van
│ Frame 1 : TS_CONFIG  [FD FF FF FF | count LE] │  ← khai báo valve_count (P.án A)
│ Frame 2 : TS_START   [FE FF FF FF | bits=0]   │  ← t0 = millis(), scheduler chạy
│ Frame 3 : ts=0       [00 00 00 00 | bits...]  │  ← data, ts tăng dần
│ Frame 4 : ts=Δt      [.. .. .. .. | bits...]  │
│   ...                                          │
│ Frame N : ts=T_max   [.. .. .. .. | bits=0]   │  ← sentinel all-off
└──────────────────────────────────────────────┘
```

- `ts_ms`: **u32 Little-Endian**, ms từ TS_START.
- `bits`: `valve_bytes_per_frame` byte, **MSB first** — bit 7 byte[0] = van 0.
  `buf[v>>3] |= 1 << (7 - (v&7))` (y hệt spec cũ, chỉ dài hơn).
- Reserved ts_ms:
  | ts_ms | Ý nghĩa |
  |---|---|
  | `0xFFFFFFFF` | TS_RESET |
  | `0xFFFFFFFE` | TS_START |
  | `0xFFFFFFFD` | **TS_CONFIG (mới)** — payload = valve_count u16 LE |
  | `0x00000000`–`0xFFFFFFFC` | data thường |

> CONFIG frame chỉ cần 6 byte (4 ts + 2 count). Nếu firmware muốn mọi frame cùng độ dài
> cho dễ parse, có thể pad CONFIG lên `4 + bytes` byte (phần thừa = 0); app làm theo
> firmware chọn. Ghi rõ quyết định này vào CLAUDE.md.

---

## 4. Đồng bộ tickMs HAI CHIỀU (row_interval_ms ⇄ EFFECT_TICK_MS)

App có `row_interval_ms` = khoảng cách thời gian giữa 2 hàng van. Firmware có
`EFFECT_TICK_MS` = sàn cơ học van solenoid, expose qua `GET /version → {"tickMs":N}`.
Hai bên **đồng bộ hai chiều**:

### Chiều đọc (firmware → app)
- App khi kết nối **poll `GET http://<ip>:8080/version`** → lấy `tickMs`.
- App dùng `tickMs` làm **giá trị tối thiểu** cho `row_interval_ms` (không cho nhỏ hơn
  sàn cơ học — nhỏ hơn van không kịp đóng/mở).
- Hiển thị cho người dùng: "Sàn thiết bị: N ms".

### Chiều ghi (app → firmware)
- Nếu người dùng đặt `row_interval_ms` **lớn hơ">= tickMs` (chậm hơn, an toàn), app gửi
  giá trị này xuống để firmware/scheduler dùng cho session hiện tại.
- Cơ chế gửi: thêm lệnh JSON (xem §5) `{"cmd":"SET_TICK","ms":N}`.
- Firmware nhận → cập nhật biến runtime (không ghi đè hằng cơ học, chỉ nâng lên nếu app
  muốn chậm hơn). Khi reset về mặc định = `EFFECT_TICK_MS`.

> Quy tắc an toàn: `effective_tick = max(EFFECT_TICK_MS, row_interval_ms)`.
> Van không bao giờ bị ép nhanh hơn sàn cơ học.

---

## 5. Lệnh JSON (WebSocket text, port 3333)

App mới **chỉ dùng Stream mode** — bỏ sound/clock/text/effect. Tập lệnh tối thiểu:

```json
{"cmd":"ALL_OFF"}                       // tắt mọi van
{"cmd":"ALL_ON"}                        // mở mọi van (test)
{"cmd":"STREAM_STOP"}                   // dừng phát, xóa queue
{"cmd":"SET","bits":"....hex...."}      // set tức thì 1 frame (hex = bytes×2 ký tự)
{"cmd":"SET_TICK","ms":N}               // (mới) đồng bộ row_interval_ms xuống firmware
{"cmd":"GET_CONFIG"}                    // (mới) xin valve_count + tickMs hiện tại
```

- `SET.bits`: chuỗi hex độ dài `valve_bytes_per_frame × 2` ký tự (động, không cố định 20).
- Bỏ `SET_MODE` (không còn đa mode). Firmware có thể giữ lại để tương thích ngược nhưng
  app không phát.

> Có thể giữ port 8888 UDP (GET_INFO/SET_IP/SET_PORT) và 8080 OTA như cũ — app nên tận
> dụng `/version` và có thể thêm nút OTA sau.

---

## 6. Luồng app gửi (Stream trực tiếp & xuất file)

### Xuất file `.bin` (mục tiêu chính)
```
RESET → CONFIG(valve_count) → START → data frames(ts↑) → sentinel(all-off)
→ ghi ra .bin → người dùng nạp qua thẻ control (control.html Admin / SD / OTA tùy luồng)
```

### Gửi trực tiếp WebSocket 3333 (chunked, tôn trọng queue 512)
```
① poll /version → tickMs, ép row_interval_ms ≥ tickMs
② mở ws://ip:3333
③ gửi RESET + CONFIG + START (1 lần)
④ gửi data theo chunk ≤ ~400 frame, chờ drain (sleep ≈ chunk × tick × 0.8)
⑤ gửi sentinel all-off
```

---

## 7. Việc cần làm ở firmware (checklist cho Claude Code)

```
☐ Đọc số byte frame ĐỘNG, không hardcode 10:
   - Ưu tiên P.án A: parse TS_CONFIG (0xFFFFFFFD) → valve_count → bytes = ceil(count/8)
   - Hoặc P.án B: NUM_BOARDS trong config.h khớp phần cứng + app fixedFrameBytes
☐ valve_driver.h: shift đủ `bytes` byte ra HSPI (đang cố định 10 → sửa thành biến)
☐ frame_queue.h: frame size động (cấp phát theo bytes hiện hành)
☐ scheduler.h: latch theo ts_ms như cũ, chỉ độ dài bits thay đổi
☐ TS_CONFIG handler mới (nếu P.án A)
☐ SET_TICK handler: effective_tick = max(EFFECT_TICK_MS, ms từ app)
☐ GET /version trả thêm valve_count hiện tại (ngoài tickMs) để app verify khớp
☐ GET_CONFIG (JSON) trả {valve_count, tickMs}
☐ Bỏ/ngắt 5 mode cũ khỏi luồng chính (giữ code nếu muốn, nhưng app chỉ Stream)
☐ Tăng FW_VERSION trước khi build để xác nhận OTA
☐ Test: nạp file .bin 8m (44 byte/frame) → van shift đúng, không lệch khung
```

---

## 8. Điểm kiểm tra tương thích (QUAN TRỌNG)

1. **Lệch khung byte** = lỗi chí mạng. Nếu firmware đọc 10 byte mà app gửi 44 byte →
   mọi van loạn. Verify `valve_count` app gửi == `ceil` firmware tính.
2. **Endian**: `ts_ms` và `valve_count` đều **Little-Endian**. `320 = 0x0140 → bytes 40 01`.
3. **MSB-first** bit packing giữ nguyên — van 0 = bit 7 byte[0].
4. **Sàn tick**: app không được gửi frame dày hơn `EFFECT_TICK_MS`; firmware tự kẹp
   `max()` để an toàn van.
5. **Forward-compat**: firmware chưa hiểu TS_CONFIG nên **bỏ qua** frame ts reserved lạ,
   không crash.
```
