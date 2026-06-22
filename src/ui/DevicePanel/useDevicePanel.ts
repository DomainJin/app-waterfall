import { useEffect } from 'react';
import { useDeviceStore } from '../../store/device';
import { usePhysicalStore } from '../../store/physical';
import {
  cmdAllOff,
  cmdAllOn,
  cmdGetConfig,
  cmdStreamStop,
} from '../../transport';

// State/handlers for the device (valve controller) connection panel.
export function useDevicePanel() {
  const ip = useDeviceStore((s) => s.ip);
  const status = useDeviceStore((s) => s.status);
  const everConnected = useDeviceStore((s) => s.everConnected);
  const tickMs = useDeviceStore((s) => s.tickMs);
  const valveCount = useDeviceStore((s) => s.valveCount);
  const error = useDeviceStore((s) => s.error);
  const queueWarning = useDeviceStore((s) => s.queueWarning);
  const setIp = useDeviceStore((s) => s.setIp);
  const connect = useDeviceStore((s) => s.connect);
  const disconnect = useDeviceStore((s) => s.disconnect);
  const pollVersion = useDeviceStore((s) => s.pollVersion);
  const sendText = useDeviceStore((s) => s.sendText);
  const sendSetTick = useDeviceStore((s) => s.sendSetTick);

  const row_interval_ms = usePhysicalStore((s) => s.row_interval_ms);
  const connected = status === 'connected';
  const effectiveTick = Math.max(tickMs ?? 0, row_interval_ms);

  // Write direction (handoff §4): once connected, sync row_interval_ms down
  // whenever it changes (and is >= the device floor).
  useEffect(() => {
    if (connected && (tickMs == null || row_interval_ms >= tickMs)) {
      sendSetTick(row_interval_ms);
    }
  }, [connected, row_interval_ms, tickMs, sendSetTick]);

  return {
    ip,
    status,
    connected,
    everConnected,
    tickMs,
    valveCount,
    error,
    queueWarning,
    effectiveTick,
    row_interval_ms,
    setIp,
    connect,
    disconnect,
    pollVersion,
    allOff: () => sendText(cmdAllOff()),
    allOn: () => sendText(cmdAllOn()),
    streamStop: () => sendText(cmdStreamStop()),
    getConfig: () => sendText(cmdGetConfig()),
  };
}
