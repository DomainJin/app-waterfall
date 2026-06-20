import { ChannelOrder, Origin, Wiring } from '../../codec/ic9803';
import type { PayloadMode, RunMode } from '../../store/led';

interface LedControlsProps {
  brightness: number;
  gamma: number;
  channelOrder: ChannelOrder;
  wiring: Wiring;
  origin: Origin;
  payloadMode: PayloadMode;
  runMode: RunMode;
  onBrightness: (v: number) => void;
  onGamma: (v: number) => void;
  onChannelOrder: (o: ChannelOrder) => void;
  onWiring: (w: Wiring) => void;
  onOrigin: (o: Origin) => void;
  onPayloadMode: (m: PayloadMode) => void;
  onRunMode: (m: RunMode) => void;

  ip: string;
  status: string;
  error: string | null;
  autoSend: boolean;
  connected: boolean;
  onIp: (ip: string) => void;
  onAutoSend: (on: boolean) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSendNow: () => void;
}

const ORDER_OPTIONS: { value: ChannelOrder; label: string }[] = [
  { value: ChannelOrder.RGB, label: 'RGB' },
  { value: ChannelOrder.RBG, label: 'RBG' },
  { value: ChannelOrder.GRB, label: 'GRB' },
  { value: ChannelOrder.GBR, label: 'GBR' },
  { value: ChannelOrder.BRG, label: 'BRG' },
  { value: ChannelOrder.BGR, label: 'BGR' },
];

export function LedControls({
  brightness,
  gamma,
  channelOrder,
  wiring,
  origin,
  payloadMode,
  runMode,
  onBrightness,
  onGamma,
  onChannelOrder,
  onWiring,
  onOrigin,
  onPayloadMode,
  onRunMode,
  ip,
  status,
  error,
  autoSend,
  connected,
  onIp,
  onAutoSend,
  onConnect,
  onDisconnect,
  onSendNow,
}: LedControlsProps) {
  return (
    <div className="led-controls">
      <label className="led-controls__field">
        <span>brightness {brightness}</span>
        <input
          type="range"
          min={0}
          max={255}
          step={1}
          value={brightness}
          onChange={(e) => onBrightness(parseInt(e.target.value, 10))}
        />
      </label>

      <label className="led-controls__field">
        <span>gamma {gamma.toFixed(2)}</span>
        <input
          type="range"
          min={0.2}
          max={3}
          step={0.05}
          value={gamma}
          onChange={(e) => onGamma(parseFloat(e.target.value))}
        />
      </label>

      <label className="led-controls__field" title="IC9803 strips often ship with R/G/B miswired between batches">
        <span>channel order</span>
        <select value={channelOrder} onChange={(e) => onChannelOrder(Number(e.target.value) as ChannelOrder)}>
          {ORDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="led-controls__field">
        <span>wiring</span>
        <select value={wiring} onChange={(e) => onWiring(Number(e.target.value) as Wiring)}>
          <option value={Wiring.LINEAR}>Linear</option>
          <option value={Wiring.SERPENTINE}>Serpentine</option>
        </select>
      </label>

      <label className="led-controls__field">
        <span>origin</span>
        <select value={origin} onChange={(e) => onOrigin(Number(e.target.value) as Origin)}>
          <option value={Origin.TOP_LEFT}>Top-left</option>
          <option value={Origin.TOP_RIGHT}>Top-right</option>
          <option value={Origin.BOTTOM_LEFT}>Bottom-left</option>
          <option value={Origin.BOTTOM_RIGHT}>Bottom-right</option>
        </select>
      </label>

      <label className="led-controls__field">
        <span>payload</span>
        <select value={payloadMode} onChange={(e) => onPayloadMode(e.target.value as PayloadMode)}>
          <option value="rgb888">RGB888</option>
          <option value="packed16">Packed16</option>
        </select>
      </label>

      <label className="led-controls__field">
        <span>run mode</span>
        <select value={runMode} onChange={(e) => onRunMode(e.target.value as RunMode)}>
          <option value="live">Live</option>
          <option value="timestamped">Timestamped</option>
        </select>
      </label>

      <div className="led-controls__device">
        <label className="field field--inline">
          <span>IP</span>
          <input type="text" value={ip} onChange={(e) => onIp(e.target.value)} spellCheck={false} />
        </label>
        {connected ? (
          <button type="button" className="btn btn--sm" onClick={onDisconnect}>
            Disconnect
          </button>
        ) : (
          <button type="button" className="btn btn--sm" onClick={onConnect}>
            Connect :3334
          </button>
        )}
        <label className="led-controls__field">
          <input type="checkbox" checked={autoSend} onChange={(e) => onAutoSend(e.target.checked)} />
          <span>Auto-send live</span>
        </label>
        <button type="button" className="btn btn--sm" disabled={!connected} onClick={onSendNow}>
          Send now
        </button>
        <span className={`device__status device__status--${status}`}>{status}</span>
      </div>

      {error && <p className="device__error">{error}</p>}
    </div>
  );
}
