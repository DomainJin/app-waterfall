import type { RefObject } from 'react';

interface LedMatrixCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement>;
}

// Pure display — no paint/click interaction (the LED layer streams the
// video's own colors; there's no per-cell manual override like the valves).
export function LedMatrixCanvas({ canvasRef }: LedMatrixCanvasProps) {
  return <canvas className="led-canvas" ref={canvasRef} width={640} height={160} />;
}
