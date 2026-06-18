import { ConfigFields } from './ConfigFields';
import { GeometryReadout } from './GeometryReadout';
import './styles.css';

// Phase 2 deliverable: curtain length (m) input + flags, with a live readout
// of derived geometry. Thin composition — logic is in the sub-components/hook.
export function PhysicalConfig() {
  return (
    <section className="panel" data-panel="physical-config">
      <h2 className="panel__title">Physical config</h2>
      <ConfigFields />
      <GeometryReadout />
    </section>
  );
}
