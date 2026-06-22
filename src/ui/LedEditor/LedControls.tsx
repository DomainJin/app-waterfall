import { ChannelOrder, Origin, Wiring } from '../../codec/ic9803';
import type { LedMode, PaletteName, RGB } from '../../core/layers/led';
import { PALETTES } from '../../core/layers/led';
import type { PayloadMode, RunMode } from '../../store/led';

interface LedControlsProps {
  brightness: number;
  gamma: number;
  mode: LedMode;
  baseColor: RGB;
  fadeSpeed: number;
  paletteName: PaletteName;
  channelOrder: ChannelOrder;
  wiring: Wiring;
  origin: Origin;
  payloadMode: PayloadMode;
  runMode: RunMode;
  exporting: boolean;
  status: string;
  onBrightness: (v: number) => void;
  onGamma: (v: number) => void;
  onMode: (m: LedMode) => void;
  onBaseColor: (c: RGB) => void;
  onFadeSpeed: (v: number) => void;
  onPaletteName: (name: PaletteName) => void;
  onChannelOrder: (o: ChannelOrder) => void;
  onWiring: (w: Wiring) => void;
  onOrigin: (o: Origin) => void;
  onPayloadMode: (m: PayloadMode) => void;
  onRunMode: (m: RunMode) => void;
  onExport: () => void;
}

const ORDER_OPTIONS: { value: ChannelOrder; label: string }[] = [
  { value: ChannelOrder.RGB, label: 'RGB' },
  { value: ChannelOrder.RBG, label: 'RBG' },
  { value: ChannelOrder.GRB, label: 'GRB' },
  { value: ChannelOrder.GBR, label: 'GBR' },
  { value: ChannelOrder.BRG, label: 'BRG' },
  { value: ChannelOrder.BGR, label: 'BGR' },
];

const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];

function rgbToHex(c: RGB): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function LedControls({
  brightness,
  gamma,
  mode,
  baseColor,
  fadeSpeed,
  paletteName,
  channelOrder,
  wiring,
  origin,
  payloadMode,
  runMode,
  exporting,
  status,
  onBrightness,
  onGamma,
  onMode,
  onBaseColor,
  onFadeSpeed,
  onPaletteName,
  onChannelOrder,
  onWiring,
  onOrigin,
  onPayloadMode,
  onRunMode,
  onExport,
}: LedControlsProps) {
  return (
    <div className="led-controls">
      <label className="led-controls__field" title="Overall LED strip brightness, applied after color/mode (0-255)">
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

      <label className="led-controls__field" title="Darken/brighten midtones without clipping black or white (1 = linear)">
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

      <label
        className="led-controls__field"
        title="Base color used by Normal (always on), Focus (lights up when a valve cluster is open) and Fade (transitions toward this on an edge)"
      >
        <span>base color</span>
        <input type="color" value={rgbToHex(baseColor)} onChange={(e) => onBaseColor(hexToRgb(e.target.value))} />
      </label>

      <label
        className="led-controls__field"
        title="Normal: always on, base color · Focus: on only where a valve cluster is open · Fade: smooth transitions on valve on/off edges · Mix Color: each pattern block gets its own palette color"
      >
        <span>LED mode</span>
        <select value={mode} onChange={(e) => onMode(e.target.value as LedMode)}>
          <option value="normal">Normal</option>
          <option value="focus">Focus</option>
          <option value="fade">Fade</option>
          <option value="mix">Mix Color</option>
        </select>
      </label>

      {mode === 'fade' && (
        <label className="led-controls__field" title="Rows to (roughly) complete a brightness transition on a valve on/off edge">
          <span>fade speed {fadeSpeed}</span>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={fadeSpeed}
            onChange={(e) => onFadeSpeed(parseInt(e.target.value, 10))}
          />
        </label>
      )}

      {mode === 'mix' && (
        <label className="led-controls__field" title="Each block of consecutive ON rows picks the next color from this palette">
          <span>palette</span>
          <select value={paletteName} onChange={(e) => onPaletteName(e.target.value as PaletteName)}>
            {PALETTE_NAMES.map((name) => (
              <option key={name} value={name}>
                {name[0].toUpperCase() + name.slice(1)}
              </option>
            ))}
          </select>
        </label>
      )}

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

      <label className="led-controls__field" title="How the physical strip is wired: Linear runs straight, Serpentine zig-zags back and forth">
        <span>wiring</span>
        <select value={wiring} onChange={(e) => onWiring(Number(e.target.value) as Wiring)}>
          <option value={Wiring.LINEAR}>Linear</option>
          <option value={Wiring.SERPENTINE}>Serpentine</option>
        </select>
      </label>

      <label className="led-controls__field" title="Which physical end of the strip is LED index 0">
        <span>origin</span>
        <select value={origin} onChange={(e) => onOrigin(Number(e.target.value) as Origin)}>
          <option value={Origin.TOP_LEFT}>Top-left</option>
          <option value={Origin.TOP_RIGHT}>Top-right</option>
          <option value={Origin.BOTTOM_LEFT}>Bottom-left</option>
          <option value={Origin.BOTTOM_RIGHT}>Bottom-right</option>
        </select>
      </label>

      <label className="led-controls__field" title="Wire payload size: RGB888 = 3 bytes/LED (human-adjustable brightness) · Packed16 = 2 bytes/LED (smaller, for long timestamped streams)">
        <span>payload</span>
        <select value={payloadMode} onChange={(e) => onPayloadMode(e.target.value as PayloadMode)}>
          <option value="rgb888">RGB888</option>
          <option value="packed16">Packed16</option>
        </select>
      </label>

      <label className="led-controls__field" title="Live: frames apply immediately on arrival · Timestamped: firmware paces frames using each frame's embedded ts_ms">
        <span>run mode</span>
        <select value={runMode} onChange={(e) => onRunMode(e.target.value as RunMode)}>
          <option value="live">Live</option>
          <option value="timestamped">Timestamped</option>
        </select>
      </label>

      <button
        type="button"
        className="btn btn--sm"
        onClick={onExport}
        disabled={exporting}
        title="Export the precomputed LED script for the whole timeline as a firmware-replayable file (same wire format as live streaming)"
      >
        {exporting ? 'Exporting…' : 'Export LED script'}
      </button>

      {status && <span className="led-controls__status">{status}</span>}
    </div>
  );
}
