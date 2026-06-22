# LED Mode — Pre-computed Script từ Valve Grid

> LED script được **tính trước** từ valve grid (đã pre-compute).
> Mỗi LED biết hoạ tiết nào đang đi qua vùng van của nó → đổi màu tương ứng.

---

## Nguyên lý: LED ở đầu băng chuyền

```
     LED strip (trên trần)
     [LED 0] [LED 1] [LED 2] ... [LED 79]
        ↓       ↓       ↓           ↓        ← ánh sáng chiếu xuống
     [4 van] [4 van] [4 van] ... [4 van]     ← van quét từng row (băng chuyền)
        ↓       ↓       ↓           ↓
      nước rơi theo gravity
```

Hoạ tiết "cuộn" qua van như băng chuyền. LED ở đầu băng chuyền → **nhìn thấy hoạ tiết
đang đến** → đổi màu phản ứng. Khi hoạ tiết đổi (vùng van chuyển từ tắt→bật hoặc ngược lại),
LED đổi màu theo.

## Dữ liệu đầu vào cho LED script

LED script đọc từ **valve grid đã pre-compute** (`valveGrid[row][col]`, boolean):
```
Với LED i, vùng van = [i×4, i×4+3]
cluster_state(row) = OR(valveGrid[row][i×4 ... i×4+3])   // cụm có van nào bật?
cluster_density(row) = count(valveGrid[row][i×4 ... i×4+3]) / 4  // mật độ 0..1
```

## Các mode

### 1. NORMAL — luôn sáng base color
- LED luôn bật, màu = `baseColor` từ color picker.
- Không phụ thuộc valve state.
- Đơn giản nhất.

### 2. FOCUS — theo valve on/off
- `cluster_state(currentRow) == true` → LED bật (base color).
- `cluster_state == false` → LED tắt.
- Kết quả: đèn chỉ sáng vùng có nước.

### 3. FADE — chuyển màu mượt
- LED luôn bật.
- Khi cluster chuyển từ OFF→ON: fade từ màu hiện tại → base color (sáng lên).
- Khi cluster chuyển từ ON→OFF: fade từ base color → dim (tối dần).
- Fade speed cấu hình được (số row để hoàn thành transition).

### 4. MIX COLOR (mới) — đổi màu theo hoạ tiết cuộn qua
- **Nguyên tắc:** mỗi khi hoạ tiết MỚI đi vào vùng LED → LED đổi sang màu mới.
- **"Hoạ tiết mới"** = cluster state thay đổi (transition edge):
  ```
  Nếu cluster_state(row) ≠ cluster_state(row-1):
    → đây là biên hoạ tiết (pattern edge)
    → LED chọn màu mới
  ```
- **Chọn màu:** random từ palette (hoặc cycle qua danh sách màu preset).
  Đảm bảo màu mới ≠ màu cũ (tránh trùng liên tiếp).
- **Vùng hoạ tiết luôn có đèn:** khi `cluster_state == true` → LED sáng màu đã chọn.
  Khi `cluster_state == false` → LED tối hoặc dim.
- **Kết quả:** mỗi "khối" hoạ tiết (nhóm row liên tiếp có van bật) có **1 màu riêng**.
  Khối tiếp theo có màu khác. Nhìn tổng thể: băng chuyền chở các khối hoạ tiết nhiều màu.

```
Ví dụ timeline (LED thứ 5):
row 0-20:  van OFF → LED tối
row 21-60: van ON  → LED sáng MÀU A (chọn khi row 21 = biên ON)
row 61-80: van OFF → LED tối
row 81-120: van ON → LED sáng MÀU B (≠ A, chọn khi row 81 = biên ON)
row 121-...: van ON → LED giữ MÀU B (cùng khối)
```

## Pre-compute LED script

**Tính trước toàn bộ** (giống valve grid), lưu vào `ledScript[row][led_col]`:

```ts
type LedCell = { r: number; g: number; b: number; a: number }  // RGBA, a=0 = tắt
ledScript: LedCell[][]  // [total_rows][led_cols]
```

**Quy trình compute:**
```
for mỗi LED i (0 → led_cols):
  current_color = null
  for mỗi row r (0 → total_rows):
    cluster = valveGrid[r][i*4 ... i*4+3]
    cluster_on = any(cluster)

    switch (mode):
      NORMAL:
        ledScript[r][i] = { ...baseColor, a: 1 }

      FOCUS:
        ledScript[r][i] = cluster_on ? { ...baseColor, a: 1 } : { 0,0,0, a: 0 }

      FADE:
        // fade toward target based on cluster state
        target = cluster_on ? baseColor : dim
        ledScript[r][i] = lerp(ledScript[r-1][i], target, fade_speed)

      MIX_COLOR:
        if cluster_on && !prev_cluster_on:
          current_color = nextColor(palette, exclude=current_color)
        ledScript[r][i] = cluster_on ? { ...current_color, a: 1 } : { 0,0,0, a: 0 }

    prev_cluster_on = cluster_on
```

**Dependency:** LED script phụ thuộc valve grid → compute LED **sau** valve grid xong.
Khi valve grid thay đổi (đổi threshold/margin/video) → recompute LED script.

## Cấu hình mở rộng (UI)

- `baseColor`: color picker (đã có).
- `ledMode`: dropdown Normal / Focus / Fade / Mix Color.
- `fadeSpeed`: slider (chỉ hiện khi mode=Fade), range 1-20 rows.
- `colorPalette`: preset hoặc custom (cho Mix Color). Mặc định: rainbow 6 màu.
- Tương lai: thêm mode mới chỉ cần thêm 1 case trong switch, không đổi kiến trúc.

## Preview render (không đổi kiến trúc)

Vẫn render LED ở đỉnh canvas, gradient xuống. Chỉ đổi: đọc màu từ `ledScript[currentRow][i]`
thay vì tính real-time. Vì đã pre-compute nên preview mượt, replay nhất quán.
