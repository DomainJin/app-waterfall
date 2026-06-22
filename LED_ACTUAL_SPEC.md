# LED Layer — Spec thực tế (thay thế cấu hình matrix cũ)

> Đính kèm file này khi yêu cầu Claude Code sửa LED layer.
> LED KHÔNG phải matrix 2D. Là **1 dải ngang trên trần, chiếu sáng xuống**.

---

## 1. Phần cứng thực tế

```
TRẦN
├── [LED strip] ─── 1 dải ngang, 10 LED/m, IC9803, RGB
│     ↓ ánh sáng chiếu XUỐNG (dọc)
│     ↓ nhạt dần theo khoảng cách
├── [Valve row] ─── 1 hàng van ngang, 40 van/m
│     ↓ nước rơi xuống
│
SÀN
```

- **1 dải duy nhất** (1D, không phải 2D matrix). `led_cols = length_m × 10`. Không có `led_rows`.
- 8m → **80 LED**. Mỗi LED cách 10cm.
- **1 LED = 4 van** (10 LED/m vs 40 van/m). LED thứ `i` phủ van `[i×4, i×4+3]`.
- LED phát **ánh sáng màu RGB** (không phải trắng đen).

## 2. Preview — cách LED hiển thị

Mỗi LED trong preview:
- Vị trí x: tại physical position (giữa 4 van tương ứng).
- Chiều ngang: phủ rộng **~5 cột van** (hơi tràn ra, ánh sáng tự nhiên).
- Chiều dọc: ánh sáng chiếu **từ trên xuống**, cường độ **nhạt dần** (gradient alpha).
  Mạnh nhất ở đỉnh (gần trần/LED), mờ dần khi xa.
- Màu: RGB theo giá trị LED hiện tại.
- Overlay lên valve water — ánh sáng LED chiếu lên nước tạo hiệu ứng màu.

```
Preview layout (side view):
─── LED strip (1 hàng đèn màu) ───  ← đỉnh canvas
     ↓↓↓ ánh sáng gradient xuống
─── Valve water (nước rơi) ─────────  ← phía dưới
```

## 3. Ba LED mode (nguồn màu từ video)

Tất cả mode lấy màu từ **video đầu vào** (cùng source binding với valve).

### Mode NORMAL — luôn sáng
- LED **luôn bật**, không phụ thuộc valve on/off.
- Màu: lấy trung bình RGB từ vùng video tương ứng (4 cột van × chiều cao sample).
- Kết quả: nền sáng màu liên tục, đổi màu theo video.

### Mode FOCUS — theo valve
- LED **chỉ bật khi van tương ứng đang mở**.
- Nếu van `[i×4, i×4+3]` có ít nhất 1 van ON → LED `i` bật, màu từ video.
- Nếu tất cả 4 van OFF → LED `i` tắt (đen).
- Kết quả: ánh sáng chỉ chiếu vào vùng có nước.

### Mode FADE — sáng mạnh, đổi màu theo hoạ tiết
- LED **luôn bật** (giống Normal) nhưng cường độ cao hơn.
- Khi van mở: LED giữ màu từ video.
- Khi hoạ tiết đổi (video frame thay đổi đáng kể): LED **chuyển màu mượt** (fade/transition).
- Kết quả: ánh sáng phản ứng theo sự thay đổi nội dung video.

### Mở rộng tương lai (ghi nhận, chưa cần build)
- Thêm mode do user tự cấu hình (color mapping, speed, sensitivity).
- Nền tảng mọi mode: **video đầu vào** quyết định màu — mode chỉ quyết định khi nào và cách LED phản ứng.

## 4. Thay đổi so với code hiện tại

| Cũ (sai) | Mới (đúng) |
|---|---|
| LED matrix 2D (`led_cols × led_rows`) | LED strip 1D (`led_cols` only) |
| `led_rows` cấu hình | Không có `led_rows` — luôn = 1 |
| Sample video thành matrix | Sample video thành 1 hàng RGB |
| Preview: matrix overlay | Preview: gradient chiếu xuống |
| Không có mode | 3 mode: Normal / Focus / Fade |

## 5. Wire-format — vẫn dùng `03_LED_WIRE_FORMAT.md`

Protocol không đổi, chỉ đơn giản hóa:
- CONFIG frame: `led_cols = length×10`, `led_rows = 1`, wiring=LINEAR, origin=TOP_LEFT.
- DATA frame: `count = led_cols` pixel, payload = RGB888 hoặc PACKED16.
- Gửi tới ESP32 riêng, port 3334.

## 6. Checklist sửa cho Claude Code

```
☐ Bỏ `led_rows` config khỏi UI và store (luôn = 1)
☐ LedLayer sample video → 1 hàng RGB (led_cols cells), mỗi cell = average 4 cột van
☐ Thêm LED mode selector: Normal / Focus / Fade
☐ Focus mode: đọc valve grid tại row hiện tại, LED chỉ bật khi van tương ứng ON
☐ Preview: LED ở đỉnh canvas, gradient chiếu xuống, phủ ~5 cột van chiều ngang
☐ Wire-format: CONFIG led_rows=1, payload count=led_cols
☐ Test: mode Normal → tất cả LED có màu, mode Focus → LED tắt khi van OFF
```
