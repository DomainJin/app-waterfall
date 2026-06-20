import { usePhysicalConfig } from './usePhysicalConfig';

// The curtain length (m) input + config flags. Pure render — state lives in
// usePhysicalConfig. No <form>.
export function ConfigFields() {
  const {
    length_m,
    row_interval_ms,
    fixedFrameBytes,
    valveIndexBase,
    led_rows,
    edge_margin,
    curtain_height_m,
    fixedOn,
    deviceTickMs,
    floor,
    effectiveTick,
    activeCols,
    marginValid,
    fallTimeMs,
    visibleRows,
    frameDurationMs,
    setLength,
    setRowIntervalMs,
    setFixedFrameBytes,
    setValveIndexBase,
    setLedRows,
    setEdgeMargin,
    setCurtainHeightM,
  } = usePhysicalConfig();

  return (
    <div className="field-grid">
      <label className="field">
        <span>Curtain length (m)</span>
        <input
          type="number"
          min={0}
          step={0.1}
          value={length_m}
          onChange={(e) => setLength(parseFloat(e.target.value))}
        />
      </label>

      <label className="field">
        <span>Row interval (ms)</span>
        <input
          type="number"
          min={floor}
          step={1}
          value={row_interval_ms}
          onChange={(e) => setRowIntervalMs(parseInt(e.target.value, 10))}
        />
        <small className="field__hint">
          {deviceTickMs
            ? `Sàn thiết bị: ${deviceTickMs} ms · effective ${effectiveTick} ms`
            : 'Sàn thiết bị: — (chưa kết nối)'}
        </small>
      </label>

      <label className="field">
        <span>Curtain height (m)</span>
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={curtain_height_m}
          onChange={(e) => setCurtainHeightM(parseFloat(e.target.value))}
        />
        <small className="field__hint">
          fall_time: {Math.round(fallTimeMs)} ms, visible_rows: {visibleRows}, frame_duration:{' '}
          {Math.round(frameDurationMs)} ms
        </small>
      </label>

      <label className="field">
        <span>LED rows (matrix height)</span>
        <input
          type="number"
          min={1}
          step={1}
          value={led_rows}
          onChange={(e) => setLedRows(parseInt(e.target.value, 10))}
        />
      </label>

      <label className="field">
        <span>Edge margin (van mỗi bên)</span>
        <input
          type="number"
          min={0}
          step={1}
          value={edge_margin}
          onChange={(e) => setEdgeMargin(parseInt(e.target.value, 10))}
        />
        <small className={`field__hint${marginValid ? '' : ' field__hint--warn'}`}>
          {marginValid
            ? `active_cols: ${activeCols} (margin ${edge_margin} mỗi bên)`
            : '⚠ 2 × margin ≥ valve_cols — vùng active rỗng'}
        </small>
      </label>

      <label className="field">
        <span>Valve index base</span>
        <select
          value={valveIndexBase}
          onChange={(e) =>
            setValveIndexBase(parseInt(e.target.value, 10) === 1 ? 1 : 0)
          }
        >
          <option value={0}>0-indexed</option>
          <option value={1}>1-indexed</option>
        </select>
      </label>

      <label className="field field--inline">
        <input
          type="checkbox"
          checked={fixedOn}
          onChange={(e) => setFixedFrameBytes(e.target.checked ? 10 : null)}
        />
        <span>Fixed frame bytes</span>
      </label>

      {fixedOn && (
        <label className="field">
          <span>Forced bytes/frame</span>
          <input
            type="number"
            min={1}
            step={1}
            value={fixedFrameBytes ?? 0}
            onChange={(e) => setFixedFrameBytes(parseInt(e.target.value, 10))}
          />
        </label>
      )}
    </div>
  );
}
