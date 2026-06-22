import type { RefObject } from 'react';

interface LedStripCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement>;
}

// Pure display — no paint/click interaction (the LED layer streams the
// video's own colors; there's no per-cell manual override like the valves).
// Short and wide: this is a single physical strip, not a matrix.
export function LedStripCanvas({ canvasRef }: LedStripCanvasProps) {
  return <canvas className="led-canvas" ref={canvasRef} width={640} height={48} />;
}
