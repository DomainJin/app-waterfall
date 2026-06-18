# Waterfall Designer — Bộ prompt build hệ thống

Bộ tài liệu này dùng để build **Waterfall Designer**: desktop app (Electron + React +
Vite + TypeScript) lập trình màn nước valve + LED matrix IC9803, điều khiển bằng video,
độ phân giải tự sinh theo chiều dài vật lý.

## Cách dùng với Claude Code

Dán theo **thứ tự** sau. Mỗi file là một bước; đợi Claude Code xác nhận bước trước chạy
được rồi mới sang bước sau.

| Thứ tự | File | Mục đích | Khi nào dán |
|---|---|---|---|
| 1 | `01_MASTER_PROMPT.md` | Bối cảnh tổng + kiến trúc + quy tắc chung | Mở đầu, dán nguyên |
| 2 | `02_PHYSICAL_AND_VALVE_SPEC.md` | Hình học vật lý + valve `.bin` codec | Khi làm Phase 2 & 5 |
| 3 | `03_LED_WIRE_FORMAT.md` | Wire-format LED ESP32 (IC9803) | Khi làm Phase 8 |
| 4 | `04_PREVIEW_AND_UI_SPEC.md` | Preview window + layout UI | Khi làm Phase 6 |
| 5 | `05_BUILD_ORDER.md` | 9 phase build tuần tự, tiêu chí done | Dùng xuyên suốt |

## Hai file spec gốc (đính kèm cho Claude Code đọc)

- `CAU_TRUC_DU_LIEU.md` — format valve `.bin` (bản gốc của bạn)
- `ic6803_protocol.md` — nguyên lý IC9803/6803 (bản gốc của bạn)

> Luôn đính kèm 2 file gốc này khi bắt đầu, để Claude Code đối chiếu byte-exact.

## Quy trình khuyến nghị

1. Mở Claude Code trong thư mục dự án trống.
2. Đính kèm `CAU_TRUC_DU_LIEU.md` + `ic6803_protocol.md`.
3. Dán `01_MASTER_PROMPT.md`. Để nó scaffold (Phase 1).
4. Dán `05_BUILD_ORDER.md`, bảo nó làm Phase 2; kèm `02_PHYSICAL_AND_VALVE_SPEC.md`.
5. Tiếp tục từng phase, kèm file spec tương ứng đúng lúc.
6. Mỗi phase: yêu cầu chạy test/demo trước khi sang phase sau.

## Quy tắc bất biến (nhắc lại ở mọi phase)

- KHÔNG hardcode 80 valve hay 10 byte — mọi thứ suy ra từ chiều dài.
- Codec thuần (pure), có unit test, không phụ thuộc UI.
- Valve `.bin` byte-exact theo `CAU_TRUC_DU_LIEU.md`.
- LED frame byte-exact theo `03_LED_WIRE_FORMAT.md`.
- Tất cả layer đọc frame qua `source.frameAt(t_ms)` — pipeline source-agnostic.
- React functional components, Zustand state, KHÔNG dùng `<form>`.
