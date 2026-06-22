import { useCallback, useState } from 'react';
import { buildLedScriptFile } from '../../core/layers/led';
import { buildValveBin } from '../../core/layers/valve';
import { useGeometry } from '../../store/physical';
import { useLedStore } from '../../store/led';
import { useValveStore } from '../../store/valve';
import { downloadBin } from '../download';

// "Export All" — valve .bin + LED script in one action. Both are built from
// the SAME precomputed grid/script the editors and live device stream read
// (see useValveEditor.exportBin / useLedEditor.exportScript), just combined
// behind one button + one destination. In Electron, the destination is a
// chosen folder (native dialog) holding both files; without Electron (plain
// browser) there's no folder picker available, so it falls back to two
// sequential browser downloads — same mechanism the single-file exports use.
export function useExportAll() {
  const geo = useGeometry();

  const valveGrid = useValveStore((s) => s.valveGrid);
  const gridRows = useValveStore((s) => s.gridRows);
  const gridCols = useValveStore((s) => s.gridCols);
  const valveMode = useValveStore((s) => s.mode);

  const script = useLedStore((s) => s.script);
  const scriptRows = useLedStore((s) => s.scriptRows);
  const scriptCols = useLedStore((s) => s.scriptCols);
  const wiring = useLedStore((s) => s.wiring);
  const origin = useLedStore((s) => s.origin);
  const channelOrder = useLedStore((s) => s.channelOrder);
  const payloadMode = useLedStore((s) => s.payloadMode);

  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState('');

  const ready = !!valveGrid && !!script && scriptRows > 0 && scriptCols > 0;

  const exportAll = useCallback(async () => {
    if (!ready || !valveGrid || !script) {
      setStatus('Not ready yet — wait for the valve grid / LED script to finish computing.');
      return;
    }
    setExporting(true);
    setStatus('Building…');
    try {
      const valveBin = buildValveBin({
        grid: valveGrid,
        cols: gridCols,
        rows: gridRows,
        row_ms: geo.row_interval_ms,
        B: geo.valve_bytes_per_frame,
        mode: valveMode,
      });
      const ledFile = buildLedScriptFile({
        script,
        rows: scriptRows,
        cols: scriptCols,
        row_ms: geo.row_interval_ms,
        wiring,
        origin,
        channelOrder,
        payloadMode,
      });

      const api = window.electronAPI;
      if (api) {
        const folder = await api.chooseExportFolder();
        if (!folder) {
          setStatus('Cancelled.');
          return;
        }
        await api.writeFilesToFolder(folder, [
          { name: 'waterfall_valve.bin', bytes: valveBin },
          { name: 'waterfall_led.bin', bytes: ledFile },
        ]);
        setStatus(`Exported to ${folder}`);
      } else {
        downloadBin(valveBin, 'waterfall_valve.bin');
        downloadBin(ledFile, 'waterfall_led.bin');
        setStatus('Exported (browser downloads).');
      }
    } catch (err) {
      setStatus(`Error: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  }, [
    ready,
    valveGrid,
    gridRows,
    gridCols,
    valveMode,
    script,
    scriptRows,
    scriptCols,
    geo.row_interval_ms,
    geo.valve_bytes_per_frame,
    wiring,
    origin,
    channelOrder,
    payloadMode,
  ]);

  return { exportAll, exporting, status, ready };
}
