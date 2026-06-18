import { useDevicePanel } from './useDevicePanel';
import './styles.css';

// Phase-5.5: valve controller connection. Connect (ws://ip:3333) + poll
// /version for the device tick floor, show effective tick, and send the
// Stream-mode JSON commands. Chunked binary streaming is Phase 7. No <form>.
export function DevicePanel() {
  const {
    ip,
    status,
    connected,
    tickMs,
    valveCount,
    error,
    effectiveTick,
    setIp,
    connect,
    disconnect,
    pollVersion,
    allOff,
    allOn,
    streamStop,
    getConfig,
  } = useDevicePanel();

  return (
    <section className="panel" data-panel="device">
      <h2 className="panel__title">
        Valve device
        <span className={`device__status device__status--${status}`}>{status}</span>
      </h2>

      <div className="device__row">
        <label className="field field--inline">
          <span>IP</span>
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            spellCheck={false}
          />
        </label>
        {connected ? (
          <button type="button" className="btn btn--sm" onClick={disconnect}>
            Disconnect
          </button>
        ) : (
          <button type="button" className="btn btn--sm" onClick={() => void connect()}>
            Connect :3333
          </button>
        )}
        <button type="button" className="btn btn--sm" onClick={() => void pollVersion()}>
          Poll /version
        </button>
      </div>

      <div className="device__readout">
        <span>
          Sàn thiết bị: <b>{tickMs != null ? `${tickMs} ms` : '—'}</b>
        </span>
        <span>
          effective tick: <b>{effectiveTick} ms</b>
        </span>
        <span>
          device valve_count: <b>{valveCount != null ? valveCount : '—'}</b>
        </span>
      </div>

      <div className="device__commands">
        <button type="button" className="btn btn--sm" disabled={!connected} onClick={allOff}>
          ALL_OFF
        </button>
        <button type="button" className="btn btn--sm" disabled={!connected} onClick={allOn}>
          ALL_ON
        </button>
        <button
          type="button"
          className="btn btn--sm"
          disabled={!connected}
          onClick={streamStop}
        >
          STREAM_STOP
        </button>
        <button
          type="button"
          className="btn btn--sm"
          disabled={!connected}
          onClick={getConfig}
        >
          GET_CONFIG
        </button>
      </div>

      {error && <p className="device__error">{error}</p>}
    </section>
  );
}
