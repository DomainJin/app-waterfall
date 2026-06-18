# IC 6803 / LPD6803 — Nguyên lý và lập trình

## 1. Tổng quan phần cứng

IC 6803 (còn gọi là LPD6803) là chip điều khiển LED RGB pixel 12V, thường gặp trong dây đèn pixel tròn ngoài trời.

### Sơ đồ chân (1 module pixel)

```
      ┌─────────────────┐
12V ──┤ VCC             │
GND ──┤ GND             ├── LED R
DATA ─┤ DIN    IC 6803  ├── LED G
CLK ──┤ CIN             ├── LED B
      │                 │
      │ DOUT ───────────┼──► DIN của module tiếp theo
      │ COUT ───────────┼──► CIN của module tiếp theo
      └─────────────────┘
```

- **VCC / GND**: nguồn 12V cho LED (KHÔNG nối vào 3.3V của ESP32)
- **DIN / CIN**: tín hiệu DATA và CLOCK vào (từ ESP32 hoặc module trước)
- **DOUT / COUT**: tín hiệu truyền tiếp sang module kế trong chuỗi
- **Mức logic tín hiệu**: 5V hoặc 3.3V (IC 6803 chấp nhận cả hai)

### Sơ đồ chuỗi nhiều module

```
ESP32         Module 1        Module 2        Module N
GPIO25 ──► DIN─[IC6803]─DOUT──► DIN─[IC6803]─DOUT ── ... ──► DIN─[IC6803]
GPIO26 ──► CIN─[IC6803]─COUT──► CIN─[IC6803]─COUT ── ... ──► CIN─[IC6803]
GND   ──► GND               GND               GND
12V   ──► VCC               VCC               VCC
```

> **Lưu ý an toàn**: GND của nguồn 12V phải nối chung với GND của ESP32. Không nối 12V vào pin ESP32.

---

## 2. Giao thức truyền dữ liệu

IC 6803 dùng giao thức **synchronous serial** (đồng bộ theo xung clock), tương tự SPI nhưng không có CS. Dữ liệu được đẩy qua chuỗi kiểu **shift register** — mỗi xung clock đẩy dữ liệu sang module tiếp theo.

### 2.1 Cấu trúc một frame

```
│◄────── Start ──────►│◄──── N × Pixel (16 bit/pixel) ────►│◄── Latch ──►│
│  32 xung CLK        │  P0  │  P1  │  P2  │ ... │  PN-1  │  ⌈N/2⌉ CLK  │
│  DATA = 0           │      │      │      │     │        │  DATA = 0    │
```

### 2.2 Cấu trúc 1 pixel — 16 bit

```
Bit:  15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
      ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
      │ 1 │R4 │R3 │R2 │R1 │R0 │G4 │G3 │G2 │G1 │G0 │B4 │B3 │B2 │B1 │B0│
      └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘
       ▲                                                                
       └── Bit cờ, luôn = 1 (bắt buộc)
```

- Bit 15: **luôn = 1** (nếu = 0, IC bỏ qua pixel đó)
- Bits 14–10: **Red** (5 bit, 0–31)
- Bits 9–5: **Green** (5 bit, 0–31)
- Bits 4–0: **Blue** (5 bit, 0–31)

Chuyển từ màu 8-bit (0–255) sang 5-bit (0–31):

```c
uint8_t r5 = r8 >> 3;   // lấy 5 bit cao
uint8_t g5 = g8 >> 3;
uint8_t b5 = b8 >> 3;

uint16_t pixel = (1u << 15) | ((uint16_t)r5 << 10) | ((uint16_t)g5 << 5) | b5;
```

### 2.3 Timing CLK

```
CLK:  ___┌─┐_┌─┐_┌─┐_
DATA: ───X─X─X─X─X─X──   (dữ liệu ổn định trước rising edge)
         ↑ lấy mẫu tại đây
```

- Tốc độ clock tối đa: ~4 MHz
- Bit-bang với `digitalWrite` trên ESP32: ~800 kHz — hoàn toàn đủ

---

## 3. Lý do cần Start frame và Latch

### Start frame (32 bit 0)

IC 6803 dùng kiến trúc shift register: mỗi module nhận dữ liệu từ DIN và chuyển tiếp ra DOUT. Để module đầu tiên biết đây là "bắt đầu frame mới", cần gửi 32 xung clock với DATA = 0 trước.

```
Trước start:  IC1[cũ] → IC2[cũ] → IC3[cũ]
Sau 32 zero:  IC1[ 0] → IC2[cũ] → IC3[cũ]   ← IC1 đã nhận 0
Sau P0:       IC1[P0] → IC2[ 0] → IC3[cũ]   ← dữ liệu dịch dần
Sau P1:       IC1[P1] → IC2[P0] → IC3[ 0]
```

### Latch (⌈N/2⌉ xung)

Sau khi gửi xong N pixel, dữ liệu mới đang ở trong shift register nhưng chưa hiển thị. Cần thêm ⌈N/2⌉ xung clock để tín hiệu latch lan truyền hết chuỗi và LED sáng theo màu mới.

---

## 4. Triển khai trên ESP32 (bit-bang)

### 4.1 Gửi 1 từ 16 bit

```c
static void ic_send_word(uint16_t word) {
    for (int8_t i = 15; i >= 0; i--) {      // MSB trước
        digitalWrite(DATA_PIN, (word >> i) & 1u ? HIGH : LOW);
        digitalWrite(CLK_PIN, HIGH);
        digitalWrite(CLK_PIN, LOW);
    }
}
```

### 4.2 Flush toàn bộ dải LED

```c
static void ic_flush(uint8_t *buf, int num_leds) {
    // ① Start frame
    digitalWrite(DATA_PIN, LOW);
    for (int i = 0; i < 32; i++) {
        digitalWrite(CLK_PIN, HIGH);
        digitalWrite(CLK_PIN, LOW);
    }

    // ② Pixel data
    for (int i = 0; i < num_leds; i++) {
        uint8_t r5 = buf[i*3+0] >> 3;
        uint8_t g5 = buf[i*3+1] >> 3;
        uint8_t b5 = buf[i*3+2] >> 3;
        uint16_t w = (1u << 15) | ((uint16_t)r5 << 10) | ((uint16_t)g5 << 5) | b5;
        ic_send_word(w);
    }

    // ③ Latch
    digitalWrite(DATA_PIN, LOW);
    for (int i = 0; i < (num_leds + 1) / 2; i++) {
        digitalWrite(CLK_PIN, HIGH);
        digitalWrite(CLK_PIN, LOW);
    }
}
```

### 4.3 Sử dụng

```c
void setup() {
    pinMode(25, OUTPUT);   // DATA
    pinMode(26, OUTPUT);   // CLK
    digitalWrite(25, LOW);
    digitalWrite(26, LOW);
}

void loop() {
    uint8_t buf[50 * 3] = {0};       // 50 LED, nền đen

    // Bật LED thứ 0 màu đỏ full
    buf[0] = 255; buf[1] = 0; buf[2] = 0;

    ic_flush(buf, 50);
    delay(100);
}
```

---

## 5. Hiệu ứng Chase (Comet)

### Nguyên lý

Mỗi frame, vị trí đầu comet tăng 1. Mỗi pixel trong đuôi được tô màu với độ sáng giảm dần theo khoảng cách từ đầu:

```
Vị trí:  [head]  [head-1]  [head-2]  ...  [head-11]  [head-12..]
Độ sáng:  255      228       204      ...      2          0
Công thức: val = 255 × ((TAIL_LEN - d) / TAIL_LEN)²
```

Dùng giảm bậc hai (quadratic) thay vì tuyến tính để đuôi trông tự nhiên hơn — sáng nhanh ở đầu, tắt chậm ở cuối.

### Code cốt lõi

```c
#define COMET_COUNT   3    // số comet chạy song song
#define TAIL_LEN     12    // độ dài đuôi

static int s_head = 0;

void chase_update(uint8_t *buf, int num_leds, uint8_t hue) {
    s_head = (s_head + 1) % num_leds;
    memset(buf, 0, num_leds * 3);                   // xoá nền

    int spacing = num_leds / COMET_COUNT;

    for (int c = 0; c < COMET_COUNT; c++) {
        int head = (s_head + c * spacing) % num_leds;

        for (int d = 0; d < TAIL_LEN; d++) {
            int pos = (head - d + num_leds) % num_leds;

            // Độ sáng giảm bậc hai
            uint32_t fade = TAIL_LEN - d;
            uint8_t val = (uint8_t)(fade * fade * 255 / (TAIL_LEN * TAIL_LEN));

            uint8_t r, g, b;
            hsv_to_rgb(hue, 255, val, &r, &g, &b);

            // Cộng dồn (tránh overflow khi comet chồng nhau)
            buf[pos*3+0] = min(255, buf[pos*3+0] + r);
            buf[pos*3+1] = min(255, buf[pos*3+1] + g);
            buf[pos*3+2] = min(255, buf[pos*3+2] + b);
        }
    }
}
```

---

## 6. So sánh IC 6803 vs SM16703

| Tiêu chí | IC 6803 / LPD6803 | SM16703 |
|---|---|---|
| Số dây tín hiệu | 2 (DATA + CLK) | 1 (DATA) |
| Điện áp | 12V | 5V |
| Bit màu/kênh | 5 bit (0–31) | 8 bit (0–255) |
| Dải màu | 32768 màu | 16.7M màu |
| Giao thức | Synchronous (CLK) | Async (timing-based) |
| Lập trình | Bit-bang dễ, CLK linh hoạt | Cần timing chính xác (RMT) |
| Nhiễu | Ít hơn (CLK đồng bộ) | Dễ bị nhiễu nếu timing sai |

---

## 7. Lưu ý khi tích hợp với ESP32

| Vấn đề | Giải thích | Giải pháp |
|---|---|---|
| Bit-bang chặn CPU ~1.5ms | 50 LED × 16 bit × 2 `digitalWrite` ≈ 1600 lần | Chấp nhận được; Motor ISR vẫn preempt |
| Màu sai thứ tự (R↔G↔B) | Thứ tự byte R/G/B có thể khác nhau giữa các lô hàng | Swap thứ tự r5/g5/b5 trong `ic_flush()` |
| Chỉ 5 bit màu | Gradient không mượt bằng SM16703 | Dùng HSV để phân bố màu đều hơn |
| Nguồn 12V | LED tiêu thụ nhiều hơn LED 5V | Dùng nguồn riêng, nối chung GND |
