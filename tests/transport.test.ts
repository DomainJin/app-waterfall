import { describe, expect, it } from 'vitest';
import {
  bytesToHex,
  cmdAllOff,
  cmdAllOn,
  cmdGetConfig,
  cmdSet,
  cmdSetTick,
  cmdStreamStop,
  fetchVersion,
  parseVersion,
  ValveSocket,
} from '../src/transport';
import type { WebSocketLike } from '../src/transport';
import { valveBits } from '../src/codec/valveBin';

describe('bytesToHex', () => {
  it('uppercase, zero-padded', () => {
    expect(bytesToHex(new Uint8Array([0xff, 0x00, 0x40]))).toBe('FF0040');
    expect(bytesToHex(new Uint8Array([0x01]))).toBe('01');
  });
});

describe('JSON commands', () => {
  it('ALL_OFF / ALL_ON / STREAM_STOP / GET_CONFIG', () => {
    expect(JSON.parse(cmdAllOff())).toEqual({ cmd: 'ALL_OFF' });
    expect(JSON.parse(cmdAllOn())).toEqual({ cmd: 'ALL_ON' });
    expect(JSON.parse(cmdStreamStop())).toEqual({ cmd: 'STREAM_STOP' });
    expect(JSON.parse(cmdGetConfig())).toEqual({ cmd: 'GET_CONFIG' });
  });

  it('SET.bits is dynamic-length hex (bytes × 2), not fixed 20 chars', () => {
    // B=1: valves 0,1 -> 0xC0 -> "C0" (2 chars)
    expect(JSON.parse(cmdSet(valveBits([0, 1], 1)))).toEqual({
      cmd: 'SET',
      bits: 'C0',
    });
    // B=10 -> 20 hex chars; B=40 -> 80 hex chars (dynamic)
    expect(JSON.parse(cmdSet(valveBits([0], 10))).bits.length).toBe(20);
    expect(JSON.parse(cmdSet(valveBits([0], 40))).bits.length).toBe(80);
  });

  it('SET_TICK carries a rounded, >=1 ms value', () => {
    expect(JSON.parse(cmdSetTick(80))).toEqual({ cmd: 'SET_TICK', ms: 80 });
    expect(JSON.parse(cmdSetTick(15.6)).ms).toBe(16);
    expect(JSON.parse(cmdSetTick(0)).ms).toBe(1);
  });

  it('no command emits SET_MODE (Stream mode only)', () => {
    const all = [
      cmdAllOff(),
      cmdAllOn(),
      cmdStreamStop(),
      cmdGetConfig(),
      cmdSetTick(50),
      cmdSet(valveBits([0], 1)),
    ].join(' ');
    expect(all).not.toContain('SET_MODE');
  });
});

describe('parseVersion', () => {
  it('extracts tickMs + valve_count', () => {
    expect(parseVersion({ tickMs: 30, valve_count: 320 })).toMatchObject({
      tickMs: 30,
      valveCount: 320,
    });
  });

  it('accepts camelCase valveCount', () => {
    expect(parseVersion({ valveCount: 80 }).valveCount).toBe(80);
  });

  it('missing / non-numeric / null -> nulls', () => {
    expect(parseVersion({})).toMatchObject({ tickMs: null, valveCount: null });
    expect(parseVersion({ tickMs: 'x' }).tickMs).toBeNull();
    expect(parseVersion(null)).toMatchObject({ tickMs: null, valveCount: null });
  });
});

describe('fetchVersion (injected fetch)', () => {
  const okFetch = (body: unknown): typeof fetch =>
    (async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;

  it('returns parsed version on success', async () => {
    const v = await fetchVersion('1.2.3.4', 8080, okFetch({ tickMs: 25, valve_count: 80 }));
    expect(v).toMatchObject({ tickMs: 25, valveCount: 80 });
  });

  it('returns null on non-ok response', async () => {
    const bad = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await fetchVersion('1.2.3.4', 8080, bad)).toBeNull();
  });

  it('returns null when fetch throws (no device)', async () => {
    const throwing = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    expect(await fetchVersion('1.2.3.4', 8080, throwing)).toBeNull();
  });
});

// Fake socket — duck-types just the fields ValveSocket touches, so connect/
// send/throttle logic is testable without a real WebSocket/network.
interface FakeWebSocket extends Omit<WebSocketLike, 'bufferedAmount'> {
  bufferedAmount: number; // mutable here so tests can simulate backlog
  sent: (string | Uint8Array)[];
  triggerOpen(): void;
  triggerClose(): void;
  triggerError(): void;
}

function fakeWebSocket(): FakeWebSocket {
  const sent: (string | Uint8Array)[] = [];
  const ws: FakeWebSocket = {
    binaryType: '',
    bufferedAmount: 0,
    onopen: null,
    onclose: null,
    onerror: null,
    send: (data) => sent.push(data),
    close: () => {},
    sent,
    triggerOpen: () => ws.onopen?.(),
    triggerClose: () => ws.onclose?.(),
    triggerError: () => ws.onerror?.(),
  };
  return ws;
}

describe('ValveSocket', () => {
  it('connect() resolves and reports status connecting -> connected', async () => {
    const ws = fakeWebSocket();
    const statuses: string[] = [];
    const socket = new ValveSocket({ onStatus: (s) => statuses.push(s), createWebSocket: () => ws });

    const connectPromise = socket.connect('ws://device/');
    expect(statuses).toEqual(['connecting']);
    ws.triggerOpen();
    await connectPromise;
    expect(statuses).toEqual(['connecting', 'connected']);
    expect(socket.status).toBe('connected');
  });

  it('connect() rejects and reports status error on a socket error', async () => {
    const ws = fakeWebSocket();
    const statuses: string[] = [];
    const socket = new ValveSocket({ onStatus: (s) => statuses.push(s), createWebSocket: () => ws });

    const connectPromise = socket.connect('ws://device/');
    ws.triggerError();
    await expect(connectPromise).rejects.toThrow('WebSocket error');
    expect(statuses).toEqual(['connecting', 'error']);
  });

  it('an unexpected close reports status disconnected', async () => {
    const ws = fakeWebSocket();
    const statuses: string[] = [];
    const socket = new ValveSocket({ onStatus: (s) => statuses.push(s), createWebSocket: () => ws });
    const connectPromise = socket.connect('ws://device/');
    ws.triggerOpen();
    await connectPromise;

    ws.triggerClose(); // device dropped the connection unexpectedly
    expect(statuses).toEqual(['connecting', 'connected', 'disconnected']);
    expect(socket.status).toBe('disconnected');
  });

  it('sendText/sendBinary refuse when not connected', () => {
    const ws = fakeWebSocket();
    const socket = new ValveSocket({ createWebSocket: () => ws });
    expect(socket.sendText('{}')).toBe(false);
    expect(socket.sendBinary(new Uint8Array([1]))).toBe(false);
    expect(ws.sent).toEqual([]);
  });

  it('sends once connected', async () => {
    const ws = fakeWebSocket();
    const socket = new ValveSocket({ createWebSocket: () => ws });
    const connectPromise = socket.connect('ws://device/');
    ws.triggerOpen();
    await connectPromise;

    expect(socket.sendText('{"cmd":"ALL_OFF"}')).toBe(true);
    expect(socket.sendBinary(new Uint8Array([1, 2, 3]))).toBe(true);
    expect(ws.sent).toEqual(['{"cmd":"ALL_OFF"}', new Uint8Array([1, 2, 3])]);
  });

  it('throttles sends when bufferedAmount exceeds the limit, and warns (not silently)', async () => {
    const ws = fakeWebSocket();
    const overflows: number[] = [];
    const socket = new ValveSocket({
      createWebSocket: () => ws,
      onQueueOverflow: (bytes) => overflows.push(bytes),
      maxBufferedBytes: 100,
    });
    const connectPromise = socket.connect('ws://device/');
    ws.triggerOpen();
    await connectPromise;

    ws.bufferedAmount = 101;
    expect(socket.sendBinary(new Uint8Array([1]))).toBe(false);
    expect(ws.sent).toEqual([]); // throttled, not sent
    expect(overflows).toEqual([101]);
  });

  it('resumes sending once the buffer drains below the limit', async () => {
    const ws = fakeWebSocket();
    const socket = new ValveSocket({ createWebSocket: () => ws, maxBufferedBytes: 100 });
    const connectPromise = socket.connect('ws://device/');
    ws.triggerOpen();
    await connectPromise;

    ws.bufferedAmount = 200;
    expect(socket.sendBinary(new Uint8Array([1]))).toBe(false);
    ws.bufferedAmount = 0; // device caught up
    expect(socket.sendBinary(new Uint8Array([2]))).toBe(true);
    expect(ws.sent).toEqual([new Uint8Array([2])]);
  });

  it('close() reports disconnected and closes the underlying socket', async () => {
    const ws = fakeWebSocket();
    let closeCalls = 0;
    ws.close = () => {
      closeCalls++;
    };
    const statuses: string[] = [];
    const socket = new ValveSocket({ onStatus: (s) => statuses.push(s), createWebSocket: () => ws });
    const connectPromise = socket.connect('ws://device/');
    ws.triggerOpen();
    await connectPromise;

    socket.close();
    expect(closeCalls).toBe(1);
    expect(statuses[statuses.length - 1]).toBe('disconnected');
    expect(socket.sendText('{}')).toBe(false); // socket cleared, nothing to send to
  });
});
