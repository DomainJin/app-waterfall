import { formatMs } from '../../core/timeline';

interface TimeReadoutProps {
  positionMs: number;
  durationMs: number;
}

// Live `mm:ss.mmm / mm:ss.mmm` + raw ms readout.
export function TimeReadout({ positionMs, durationMs }: TimeReadoutProps) {
  return (
    <div className="timeline__readout" data-testid="timeline-readout">
      <span className="timeline__pos">{formatMs(positionMs)}</span>
      <span className="timeline__sep">/</span>
      <span className="timeline__dur">{formatMs(durationMs)}</span>
      <span className="timeline__ms">{Math.round(positionMs)} ms</span>
    </div>
  );
}
