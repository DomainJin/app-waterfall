import { useGeometry } from '../../store/physical';

// Live readout of the derived geometry. Re-renders whenever any input changes.
export function GeometryReadout() {
  const geo = useGeometry();

  return (
    <div className="readout" data-testid="geometry-readout">
      <div className="readout__item">
        <span className="readout__label">valve_cols</span>
        <span className="readout__value">{geo.valve_cols}</span>
      </div>
      <div className="readout__item">
        <span className="readout__label">active_cols</span>
        <span className="readout__value">
          {geo.active_cols}
          {geo.edge_margin > 0 && (
            <span className="readout__tag">margin {geo.edge_margin}/bên</span>
          )}
        </span>
      </div>
      <div className="readout__item">
        <span className="readout__label">led_cols</span>
        <span className="readout__value">{geo.led_cols}</span>
      </div>
      <div className="readout__item">
        <span className="readout__label">valve_bytes_per_frame</span>
        <span className="readout__value">
          {geo.valve_bytes_per_frame}
          {geo.fixedFrameBytes != null && (
            <span className="readout__tag">forced</span>
          )}
        </span>
      </div>
      <div className="readout__item">
        <span className="readout__label">frame size (bytes)</span>
        <span className="readout__value">{4 + geo.valve_bytes_per_frame}</span>
      </div>
      <div className="readout__item">
        <span className="readout__label">fall_time</span>
        <span className="readout__value">{Math.round(geo.fall_time_ms)} ms</span>
      </div>
      <div className="readout__item">
        <span className="readout__label">visible_rows</span>
        <span className="readout__value">{geo.visible_rows}</span>
      </div>
      <div className="readout__item">
        <span className="readout__label">frame_duration</span>
        <span className="readout__value">{Math.round(geo.frame_duration_ms)} ms</span>
      </div>
    </div>
  );
}
