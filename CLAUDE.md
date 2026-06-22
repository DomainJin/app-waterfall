# Quy tắc làm việc với Claude Code

> File này đặt ở gốc project hoặc đính kèm khi bắt đầu session.
> Áp dụng chung cho mọi dự án — không chứa logic riêng project nào.

---

## 1. Kiến trúc code

### Module hóa — Single Responsibility
- Mỗi file làm **đúng một việc**. Khi file có nhiều hơn một lý do để thay đổi → tách.
- Tách theo **3 chiều**:
  - Logic / UI / style riêng file.
  - Mỗi component 1 thư mục: `ComponentName/index.tsx` + `hooks.ts` + `styles.ts` + sub-components. Có `index.ts` re-export.
  - Custom hook tách khỏi component: component chỉ render, mọi state/effect/handler phức tạp đưa vào `useXxx.ts`.
- Codec & core **tuyệt đối không import UI**. Giữ pure, testable.
- Mỗi domain một store file (không gộp store khổng lồ). Selector/derived hook tách riêng.
- Barrel exports (`index.ts`) gọn import, nhưng **cảnh giác circular dependency** — nếu có warning vòng phụ thuộc, sửa ngay.

### Không hardcode — Derive from config
- Mọi con số vật lý, kích thước, số lượng phải **suy ra từ input/config**, không magic number.
- Khi thấy hằng số trong code, tự hỏi: "Con số này có thể thay đổi theo cấu hình không?" Nếu có → biến config.

### Pre-compute over real-time
- Khi dữ liệu có thể tính trước (offline) → tính trước, lưu vào memory, play chỉ đọc array.
- Tránh seek/fetch/compute real-time trong render loop — gây stall, race condition, khó debug.
- Hiện progress bar khi pre-compute mất thời gian. Disable Play cho tới khi done.

### WYSIWYG — Preview = Export = Output
- Những gì user nhìn thấy trên preview phải **chính xác** là thứ sẽ export/gửi tới thiết bị.
- Cùng nguồn dữ liệu (cùng grid/buffer), không tính riêng cho preview rồi tính lại cho export.

---

## 2. Quy trình build

### Phase-by-phase — không nhảy cóc
- Chia project thành **các phase tuần tự**. Mỗi phase có tiêu chí "Done" rõ ràng.
- **Chỉ làm phase được yêu cầu.** Kết thúc mỗi message bằng "Chỉ Phase X, dừng lại đợi tôi."
- Xác nhận phase trước **chạy được** (test pass + demo) rồi mới sang phase sau.
- Khi đưa build order, tách riêng file — không dán chung với prompt phase đầu tiên (tránh model tự đi tiếp).

### Refactor trước, feature sau
- Khi code bắt đầu phình (file dài, trách nhiệm lẫn lộn) → dừng lại refactor **trước** khi thêm tính năng mới.
- Refactor **thuần túy**: không đổi hành vi, test cũ phải pass nguyên, app chạy y hệt.
- Sau refactor, liệt kê: cây thư mục mới, file nào tách từ đâu, test pass + app chạy.

### Kiểm tra bằng dữ liệu thật — không tin lời
- Test code pass ≠ đúng. Luôn **verify bằng output thật**: hexdump file binary, chạy app nhìn mắt, đo số liệu.
- Đặc biệt với binary format: export file → decode thủ công → so từng byte với spec.
- Khi Claude Code tự báo "đã đúng" nhưng mắt thấy sai → tin mắt, bắt nó chứng minh bằng số liệu.

---

## 3. Testing

### Codec & core phải có unit test
- Mọi module trong `codec/` và `core/` phải có test.
- Test phải bao gồm: **happy path**, **edge case** (giá trị biên, chia không hết, 0, âm, NaN), **dynamic input** (nhiều kích thước khác nhau).
- Với binary codec: test decode output → verify byte-exact (endianness, bit packing, reserved values, sentinel).

### Test trước khi báo done
- "Viết test và chạy pass trước khi báo xong."
- Không chấp nhận "test pass" bằng lời — phải thấy output `npm test` với số test cụ thể.

### Synthetic test cho visual pipeline
- Khi cần verify visual mapping (crop vs nén, threshold direction, flip) → tạo **frame nhân tạo** (vạch trắng ở mép, sọc xen kẽ) rồi chạy qua pipeline, đọc output số.
- Không dựa vào mắt nhìn preview cho logic test — mắt cho UI, số cho logic.

---

## 4. Giao tiếp với Claude Code

### Cấu trúc message
- Mỗi message có: **context** (đang ở phase nào, cái gì đã xong), **yêu cầu cụ thể** (làm gì), **ràng buộc** (chỉ phase X, dừng lại).
- Đính kèm **đúng file spec cần thiết** cho phase đó — không đính hết (tốn context vô ích).
- Khi đưa spec dài, tách thành nhiều file, đưa đúng lúc cần.

### Câu cứu hộ
- Đi quá phase: **"Dừng, chỉ làm Phase X thôi."**
- Hardcode: **"Đang hardcode rồi, mọi thứ phải suy từ config."**
- Lỗi build: dán nguyên log → **"Fix lỗi này."**
- Quên test: **"Chưa thấy test chạy. Viết test và chạy pass trước khi báo xong."**
- Context dài, quên: **"Theo build order, đang ở Phase X."**
- Tự thuyết phục sai thành đúng: **"Đừng giải thích, chứng minh bằng dữ liệu thật."**

### Quản lý context
- Khi thấy **compaction** (tokens freed) → sắp hết context, chuẩn bị chuyển chat mới.
- Trước khi chuyển, hỏi: **"Viết resume prompt cho session này để tôi mở chat mới không mất context."**
- Chat mới: dán resume prompt + đính kèm file spec cần thiết + tiếp tục từ phase tiếp theo.
- Mỗi phase chỉ đính kèm spec **liên quan** — đừng đính hết mọi file.

### Chế độ edit
- Phase đầu (scaffold, kiến trúc mới): dùng **"Ask before edits"** — duyệt từng thay đổi.
- Phase sau (đã tin tay): chuyển **"Edit automatically"** cho nhanh.
- Khi refactor lớn: quay lại "Ask before edits" để kiểm soát.

---

## 5. Quy tắc kỹ thuật

### Stack mặc định
- React functional components + TypeScript.
- **Zustand** cho state management.
- **Vitest** cho unit test.
- **Không dùng `<form>` tags.**

### Binary protocol / firmware
- Endianness: ghi rõ trong spec (thường Little-Endian).
- Reserved values: document đầy đủ, firmware phải **bỏ qua** giá trị reserved chưa biết (forward-compatible).
- Frame tự mô tả: nếu có thể, thêm header/config frame để file không phụ thuộc firmware build.
- Verify tương thích: export file → hexdump → so với spec → thử trên thiết bị thật.

### Preview / UI
- Render loop tách khỏi React render — dùng `requestAnimationFrame` đọc state, không re-render React mỗi frame.
- Khi window đóng rồi mở lại: phải **gửi lại state hiện tại** (grid, transport state) ngay khi window mới kết nối.
- State reset khi replay: stop → play lại phải reset pump/cache/index, không dùng instance cũ.

### Transport / WebSocket
- Tôn trọng queue limit thiết bị: chunked send, drain wait.
- Tách port cho các controller khác nhau (valve ≠ LED).
- Poll device info khi connect (version, tick, config) để app đồng bộ.

---

## 6. Tài liệu & handoff

### Spec files
- Mỗi layer/protocol có file spec riêng (markdown), chứa: format, ví dụ byte, pseudo-code, checklist.
- Spec là **nguồn sự thật** — code phải khớp spec, không phải ngược lại.
- Khi đổi format → cập nhật spec trước, code sau.

### Firmware handoff
- Khi app đổi protocol → tạo file handoff mô tả: cái gì đổi, firmware cần sửa gì, checklist.
- Ghi rõ forward-compatibility: firmware cũ gặp frame mới phải bỏ qua, không crash.

### Resume prompt
- Khi chuyển chat mới, resume prompt phải chứa: kiến trúc hiện tại, phase đã xong, quy tắc bất biến, yêu cầu phase tiếp theo.
- Đủ chi tiết để Claude Code **không hỏi lại** những gì đã quyết.
