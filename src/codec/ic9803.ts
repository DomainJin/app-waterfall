// IC9803 LED wire-format codec — PURE, unit-tested, no UI imports.
// Pixel = 16 bits (per ic6803_protocol.md): bit15 = 1 (flag), then
//   R5 (bits 14-10), G5 (bits 9-5), B5 (bits 4-0); channel = rgb8 >> 3.
//   word = (1 << 15) | (r5 << 10) | (g5 << 5) | b5
// Full wire-format (start frame / latch / framing) per spec file 03.
// Implemented in Phase 8.
export {};
