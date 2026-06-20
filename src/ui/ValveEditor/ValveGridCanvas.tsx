import type { RefObject } from 'react';

interface ValveGridCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  cols: number;
  onPaintCol: (col: number, wholeColumn?: boolean) => void;
}

// Source frame + valve cell strip. Click toggles ONE cell (currentRow, col);
// Shift+click toggles the whole column (every row) instead.
export function ValveGridCanvas({
  canvasRef,
  cols,
  onPaintCol,
}: ValveGridCanvasProps) {
  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || cols <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    onPaintCol(Math.floor(frac * cols), e.shiftKey);
  }

  return (
    <canvas
      className="valve-canvas"
      ref={canvasRef}
      width={640}
      height={220}
      onClick={handleClick}
    />
  );
}
