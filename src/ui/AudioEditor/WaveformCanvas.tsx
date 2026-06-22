import type { RefObject } from 'react';

interface WaveformCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement>;
}

// Pure display — waveform + playhead, no click/scrub interaction here.
// Scrubbing the timeline happens in TimelineBar; this is read-only.
export function WaveformCanvas({ canvasRef }: WaveformCanvasProps) {
  return <canvas className="waveform-canvas" ref={canvasRef} width={640} height={80} />;
}
