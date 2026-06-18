# 03 — LED LAYER + WIRE-FORMAT ESP32 (IC9803)

> Dán khi làm **Phase 8** (LED layer). Đính kèm lại `ic6803_protocol.md`.
> Phần A: LED layer trong app. Phần B trở đi: wire-format firmware phải khớp byte-exact.

---

## A. LED layer trong app — `core/layers/LedLayer.ts` + `codec/ic9803.ts`

- **2D matrix**: nhiều dải IC9803 xếp dọc. `led_cols = length_m × 10`, `led_rows` config.
- Wiring **serpentine** hoặc **linear**, `origin` (4 góc) chọn được — app luôn gửi pixel
  **row-major**, firmware lo ánh xạ vật lý (xem CONFIG frame §4).
- Pull frame qua `source.frameAt(t_ms)` → downsample video thành `led_rows × led_cols` RGB
  (area-average mỗi cell).
- Encode mỗi pixel theo `ic6803_protocol.md`: 16-bit word, bit15=1, R5<<10|G5<<5|B5,
  với `r5 = r8>>3`. Hỗ trợ **channel order** (lô hàng hay sai R/G/B).
- Editor: matrix color preview sync timeline, brightness/gamma, toggle channel order,
  toggle wiring/origin, chọn payload mode + run mode.
- Gửi tới **ESP32 riêng** (port 3334) bằng wire-format dưới đây.

`codec/ic9803.ts` phải pure + unit-tested, implement đúng spec Phần B→.

---

# B. LED Wire-Format — ESP32 (IC9803 / LPD6803 family)

> Giao thức WebSocket binary giữa **Waterfall Designer** (app) và **ESP32 LED controller**.
> Thiết kế đồng bộ triết lý với valve `.bin`: timestamp-based, reserved control frames,
> dùng chung master clock với layer valve. Hỗ trợ **2 payload mode** (RGB888 / packed16)
> và **2 run mode** (timestamped queue / live realtime), chọn bằng flag trong header.

---

## 0. Hằng số

| Tên | Giá trị | Ghi chú |
|---|---|---|
| MAGIC | `0x57` `0x4C` (`"WL"`) | Waterfall-LED, nhận diện đầu frame |
| PROTO_VERSION | `0x01` | Tăng khi đổi format |
| WebSocket port | **3334** | Khác valve (3333) để tách controller |
| Endian (multi-byte) | **Little-Endian** | Giống valve spec |
| Max LED/frame | 4096 | Ràng buộc bộ nhớ ESP32 |
| Queue size | 256 frame | Timestamped mode |

---

## 1. Cấu trúc Frame tổng quát

```
┌──────────────── HEADER (12 bytes) ────────────────┐┌─── PAYLOAD (biến) ───┐
│ magic[2] ver flags type  ts_ms[4]   count[2]      ││  pixel data ...       │
└───────────────────────────────────────────────────┘└───────────────────────┘
```

### Header — 12 bytes cố định

| Offset | Size | Tên | Kiểu | Ý nghĩa |
|---|---|---|---|---|
| 0 | 2 | `magic` | u8[2] | `0x57 0x4C` ("WL") |
| 2 | 1 | `version` | u8 | `0x01` |
| 3 | 1 | `flags` | u8 | bitfield (xem §2) |
| 4 | 1 | `type` | u8 | loại frame (xem §3) |
| 5 | 1 | `reserved` | u8 | = `0x00`, padding/align |
| 6 | 4 | `ts_ms` | u32 LE | timestamp (timestamped mode); `0` ở live mode |
| 10 | 2 | `count` | u16 LE | số LED trong payload (0 với control frame) |

> Tổng header = 12 byte. Payload theo ngay sau, không padding.

---

## 2. Trường `flags` (bitfield)

```
bit:  7   6   5   4   3   2   1   0
      │   │   │   │   │   │   │   └─ PAYLOAD_FMT  0=RGB888, 1=PACKED16
      │   │   │   │   │   │   └───── RUN_MODE     0=LIVE,   1=TIMESTAMPED
      │   │   │   │   │   └───────── CHANNEL_SWAP 0=RGB,    1=dùng order field (§6)
      │   │   │   │   └───────────── LATCH_NOW    1=flush ra LED ngay sau frame này
      │   │   │   └───────────────── (reserved)
      │   │   └───────────────────── (reserved)
      │   └───────────────────────── (reserved)
      └───────────────────────────── (reserved)
```

- **PAYLOAD_FMT = 0 (RGB888):** payload = `count × 3` byte, thứ tự `R G B` mỗi LED (8-bit/kênh). ESP32 tự nén `>>3` sang 5-bit khi đẩy ra IC9803. Linh hoạt, app gửi màu gốc.
- **PAYLOAD_FMT = 1 (PACKED16):** payload = `count × 2` byte, mỗi LED là **16-bit word LE** đã đóng đúng định dạng IC9803: `bit15=1 | R5<<10 | G5<<5 | B5`. App nén sẵn, ESP32 đẩy thẳng (nhẹ băng thông, ít CPU ESP32).
- **RUN_MODE = 0 (LIVE):** ESP32 latch ngay khi nhận đủ frame (bỏ qua `ts_ms`). Dùng khi chỉnh tay / preview realtime.
- **RUN_MODE = 1 (TIMESTAMPED):** ESP32 đẩy frame vào queue, scheduler latch tại đúng `ts_ms` (so với TS_START). Đồng bộ chính xác với valve.
- **LATCH_NOW:** ép flush ngay bất kể mode (dùng cho frame cuối / sentinel).

---

## 3. Trường `type` (loại frame)

| Giá trị | Tên | count | payload | Ý nghĩa |
|---|---|---|---|---|
| `0x00` | `DATA` | N | có | Frame màu thường |
| `0x01` | `RESET` | 0 | trống | Xóa queue, tắt toàn bộ LED (đen) |
| `0x02` | `START` | 0 | trống | `t0 = millis()`, scheduler bắt đầu (timestamped) |
| `0x03` | `CONFIG` | 0 | 8 byte | Khai báo hình học matrix (xem §4) |
| `0x04` | `SENTINEL` | 0 | trống | Kết thúc stream, tắt LED (kèm LATCH_NOW) |
| `0x05` | `BRIGHTNESS` | 0 | 1 byte | Global brightness 0–255 (payload[0]) |
| `0x06` | `HEARTBEAT` | 0 | trống | Giữ kết nối / ping |

> Control frame (type ≥ 0x01) đặt `count = 0` trừ khi bảng ghi rõ payload riêng.

---

## 4. CONFIG frame — khai báo matrix (type `0x03`)

Gửi **một lần ngay sau RESET**, trước data. Payload = 8 byte:

| Offset | Size | Tên | Ý nghĩa |
|---|---|---|---|
| 0 | 2 | `led_cols` | u16 LE — số LED/hàng (= length_m × 10) |
| 2 | 2 | `led_rows` | u16 LE — số hàng matrix |
| 4 | 1 | `wiring` | 0=LINEAR, 1=SERPENTINE |
| 5 | 1 | `origin` | 0=TOP_LEFT,1=TOP_RIGHT,2=BOT_LEFT,3=BOT_RIGHT |
| 6 | 1 | `order` | thứ tự kênh (xem §6) |
| 7 | 1 | `reserved` | `0x00` |

> Pixel trong DATA frame xếp theo **row-major** logic (row 0 trái→phải, row 1...).
> ESP32 dùng `wiring`/`origin` để ánh xạ sang chỉ số vật lý trong chuỗi IC9803.
> Nhờ vậy app luôn gửi row-major, firmware lo phần serpentine.

---

## 5. Thứ tự stream

### Timestamped mode (đồng bộ valve)
```
① RESET                          type=0x01
② CONFIG  (led_cols/rows/wiring) type=0x03
③ START                          type=0x02   → t0 = millis()
④ DATA ts=0     count=N          type=0x00, flags RUN_MODE=1
⑤ DATA ts=Δt    count=N          ...
   ...
⑥ SENTINEL                       type=0x04, flags LATCH_NOW=1
```

### Live mode (chỉnh tay / preview)
```
① RESET                          (tùy chọn, để về đen)
② CONFIG                         (một lần khi đổi hình học)
③ DATA count=N  flags RUN_MODE=0,LATCH_NOW=1   → hiện ngay
④ DATA ...                       (mỗi frame gửi là latch)
```

> Khi đổi `led_cols`/`led_rows` (người dùng đổi chiều dài màn) → gửi lại RESET + CONFIG.

---

## 6. Trường `order` — channel order

IC9803/6803 hay sai thứ tự R/G/B giữa các lô. `order` map 3 kênh đầu ra:

| Giá trị | Output |
|---|---|
| `0x00` | RGB |
| `0x01` | RBG |
| `0x02` | GRB |
| `0x03` | GBR |
| `0x04` | BRG |
| `0x05` | BGR |

- Với **RGB888**: ESP32 hoán vị byte trước khi `>>3`.
- Với **PACKED16**: app đã nén theo `order` (ESP32 đẩy thẳng). `CHANNEL_SWAP` flag = 0 nghĩa app dùng RGB chuẩn; nếu app muốn ESP32 hoán vị, set CHANNEL_SWAP=1 và ESP32 đọc field `order` trong CONFIG.

---

## 7. Ví dụ bytes cụ thể

### RESET
```
57 4C 01 00 01 00  00 00 00 00  00 00
└MAGIC┘ V  fl ty rs └─ts_ms=0─┘ └count=0┘
        flags=0x00, type=0x01 (RESET)
```

### CONFIG: 80 cols × 8 rows, serpentine, top-left, GRB
```
57 4C 01 00 03 00  00 00 00 00  00 00     ← header (count=0)
50 00 08 00 01 00 02 00                   ← payload 8B
└cols=80┘└rows=8┘ wr or od rs
  (0x0050=80, 0x0008=8, wiring=1, origin=0, order=2=GRB)
```

### DATA timestamped, RGB888, t=160ms, 3 LED (đỏ, lục, lam)
```
57 4C 01 02 00 00  A0 00 00 00  03 00     ← header
└MAGIC┘ V  fl ty rs └ts=160─┘ └count=3┘
        flags=0x02 (RUN_MODE=1, PAYLOAD_FMT=0)
FF 00 00  00 FF 00  00 00 FF              ← payload 3×3B
```

### DATA live, PACKED16, 2 LED (đỏ full, lam full), latch ngay
```
57 4C 01 09 00 00  00 00 00 00  02 00     ← header
        flags=0x09 = 0b00001001
                     │       └ PAYLOAD_FMT=1 (packed16)
                     └──────── LATCH_NOW=1
                     (RUN_MODE=0 live)
00 FC  1F 80                              ← payload 2×2B LE
└R full┘└B full┘
 0xFC00 = 1|11111|00000|00000 (R5=31)
 0x801F = 1|00000|00000|11111 (B5=31)
```

> Lưu ý PACKED16 là **LE**: word `0xFC00` → bytes `00 FC`.

---

## 8. Pseudo-code parser ESP32

```c
// Đọc đủ 12 byte header rồi count×bytesPerPixel payload
typedef struct __attribute__((packed)) {
    uint8_t  magic[2];   // 'W','L'
    uint8_t  version;
    uint8_t  flags;
    uint8_t  type;
    uint8_t  reserved;
    uint32_t ts_ms;      // LE
    uint16_t count;      // LE
} led_header_t;

#define FLAG_PACKED16   (1<<0)
#define FLAG_TIMESTAMPED (1<<1)
#define FLAG_CHAN_SWAP  (1<<2)
#define FLAG_LATCH_NOW  (1<<3)

void on_ws_binary(const uint8_t *data, size_t len) {
    if (len < 12) return;
    led_header_t h;
    memcpy(&h, data, 12);
    if (h.magic[0] != 'W' || h.magic[1] != 'L') return;   // bỏ frame lạ
    if (h.version != 0x01) return;

    const uint8_t *payload = data + 12;
    size_t bpp = (h.flags & FLAG_PACKED16) ? 2 : 3;
    size_t need = (size_t)h.count * bpp;

    switch (h.type) {
        case 0x01: queue_clear(); leds_all_off(); ic_flush_black(); break;     // RESET
        case 0x02: g_t0 = millis(); scheduler_start(); break;                  // START
        case 0x03: parse_config(payload); break;                              // CONFIG
        case 0x04: leds_all_off(); ic_flush_black(); break;                   // SENTINEL
        case 0x05: g_brightness = payload[0]; break;                          // BRIGHTNESS
        case 0x06: /* heartbeat */ break;
        case 0x00:                                                            // DATA
            if (len < 12 + need) return;                                      // frame chưa đủ
            if (h.flags & FLAG_TIMESTAMPED)
                queue_push(h.ts_ms, payload, h.count, h.flags);
            else
                render_now(payload, h.count, h.flags);                        // live
            if (h.flags & FLAG_LATCH_NOW) ic_flush_current();
            break;
    }
}

// render_now: chuyển payload → buf RGB888 nội bộ → ic_flush()
// Nếu PACKED16: mỗi 2 byte là word IC9803 sẵn sàng, đẩy thẳng ic_send_word()
// Nếu RGB888:   nén r>>3,g>>3,b>>3 + áp order/brightness rồi ic_send_word()
```

---

## 9. Bảng so sánh 2 payload mode

| | RGB888 | PACKED16 |
|---|---|---|
| Byte/LED | 3 | 2 |
| Băng thông (80 LED) | 240 B/frame | 160 B/frame |
| CPU ESP32 | nén `>>3` mỗi pixel | đẩy thẳng |
| Brightness/gamma trên ESP32 | dễ (còn 8-bit) | mất (đã 5-bit) |
| Khi nào dùng | preview, cần chỉnh sáng phía ESP32 | stream cố định, tiết kiệm băng thông |

> Khuyến nghị: **RGB888 cho live/preview** (giữ 8-bit để chỉnh brightness),
> **PACKED16 cho stream timestamped dài** (nhẹ băng thông).

---

## 10. Checklist firmware

```
☐ Header 12 byte, magic "WL", version 0x01
☐ ts_ms, count đọc Little-Endian
☐ flags: bit0=PACKED16, bit1=TIMESTAMPED, bit2=CHAN_SWAP, bit3=LATCH_NOW
☐ bytesPerPixel = (PACKED16 ? 2 : 3)
☐ Kiểm tra len ≥ 12 + count×bpp trước khi đọc payload
☐ CONFIG đến trước DATA; lưu led_cols/rows/wiring/origin/order
☐ DATA payload row-major; ESP32 map serpentine theo wiring/origin
☐ RESET/SENTINEL → tắt LED + ic_flush
☐ Timestamped: queue theo ts_ms so với START; Live: latch ngay
☐ Port 3334 (tách khỏi valve 3333)
```

---

## 11. Cập nhật prompt Claude Code (codec/ic9803.ts)

Phần codec LED cần implement đúng spec này:

```
codec/ic9803.ts xuất các hàm:
  buildHeader(type, flags, ts_ms, count) → Uint8Array(12)
  packPixelsRGB888(cells: RGB[]) → Uint8Array           // mode 0
  packPixels16(cells: RGB[], order) → Uint8Array        // mode 1, word LE
  buildConfig(led_cols, led_rows, wiring, origin, order) → Uint8Array(20)
  buildDataFrame(cells, {ts_ms, timestamped, packed, latch, order}) → Uint8Array
  buildReset() / buildStart() / buildSentinel() / buildBrightness(v)
Tất cả pure, có unit test decode lại kiểm tra magic/LE/flags/bpp.
```
