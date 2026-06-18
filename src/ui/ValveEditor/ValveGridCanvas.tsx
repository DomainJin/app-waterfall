import type { RefObject } from 'react';

interface ValveGridCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  cols: number;
  onPaintCol: (col: number) => void;
}

// Source frame + valve cell strip. Clicking a column toggles its paint
// override for the current time row.
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
    onPaintCol(Math.floor(frac * cols));
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
