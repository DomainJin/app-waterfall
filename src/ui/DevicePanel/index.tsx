import { useDevicePanel } from './useDevicePanel';
import './styles.css';

// Single shared connection for BOTH layers: connect (ws://ip:3333) + poll
// /version for the device tick floor, send valve JSON commands. The LED
// layer streams its own binary ic9803 frames over this SAME socket
// (see store/led/store.ts) — no separate LED connection. No <form>.
export function DevicePanel() {
  const {
    ip,
    status,
    connected,
    everConnected,
    tickMs,
    valveCount,
    error,
    queueWarning,
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
        Device (valve + LED)
        <span className={`device__status device__status--${status}`}>{status}</span>
      </h2>

      <div className="device__row">
        <label className="field field--inline" title="ESP32 device IP address on the local network">
          <span>IP</span>
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            spellCheck={false}
          />
        </label>
        {connected ? (
          <button type="button" className="btn btn--sm" onClick={disconnect} title="Close the connection">
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => void connect()}
            title={everConnected ? 'Connection dropped — reconnect to the device' : 'Open the WebSocket connection'}
          >
            {everConnected ? 'Reconnect :3333' : 'Connect :3333'}
          </button>
        )}
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => void pollVersion()}
          title="Read /version over HTTP — works even without a WebSocket connection"
        >
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
      {queueWarning && <p className="device__warning">{queueWarning}</p>}
    </section>
  );
}
