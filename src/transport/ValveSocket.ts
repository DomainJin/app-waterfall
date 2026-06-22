// Minimal WebSocket client to the valve controller (ws://ip:3333).
// Sends JSON text commands and binary frames. Respects the device's send
// queue: if too many bytes are still buffered (the device can't drain fast
// enough), sends are throttled — skipped, not queued — until it drains. This
// is safe for the LED stream, where each frame is a full repaint of "current
// state" and a skipped frame is immediately superseded by the next one; it's
// never silent, callers learn about it via onQueueOverflow.

export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** The subset of WebSocket this class touches — narrow enough to inject a
 *  fake in tests without a real socket/network. */
export interface WebSocketLike {
  binaryType: string;
  readonly bufferedAmount: number;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: string | Uint8Array): void;
  close(): void;
}

function defaultCreateWebSocket(url: string): WebSocketLike {
  return new WebSocket(url) as unknown as WebSocketLike;
}

/** Bytes still buffered (not yet flushed to the OS) before a send is
 *  throttled rather than handed to the socket. Generous for a handful of LED
 *  frames — this flags a device that genuinely can't keep up, not normal
 *  jitter. */
export const DEFAULT_MAX_BUFFERED_BYTES = 64 * 1024;

export interface ValveSocketOptions {
  onStatus?: (s: SocketStatus) => void;
  /** Fired (not thrown) when a send is throttled because too much is still
   *  buffered. Carries the current bufferedAmount so the caller can show a
   *  real number, not just "something's wrong". */
  onQueueOverflow?: (bufferedBytes: number) => void;
  createWebSocket?: (url: string) => WebSocketLike;
  maxBufferedBytes?: number;
}

export class ValveSocket {
  private ws: WebSocketLike | null = null;
  private _status: SocketStatus = 'disconnected';
  private readonly onStatus?: (s: SocketStatus) => void;
  private readonly onQueueOverflow?: (bufferedBytes: number) => void;
  private readonly createWebSocket: (url: string) => WebSocketLike;
  private readonly maxBufferedBytes: number;

  constructor(opts: ValveSocketOptions = {}) {
    this.onStatus = opts.onStatus;
    this.onQueueOverflow = opts.onQueueOverflow;
    this.createWebSocket = opts.createWebSocket ?? defaultCreateWebSocket;
    this.maxBufferedBytes = opts.maxBufferedBytes ?? DEFAULT_MAX_BUFFERED_BYTES;
  }

  get status(): SocketStatus {
    return this._status;
  }

  private setStatus(s: SocketStatus) {
    this._status = s;
    this.onStatus?.(s);
  }

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.setStatus('connecting');
        const ws = this.createWebSocket(url);
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => {
          this.setStatus('connected');
          resolve();
        };
        ws.onclose = () => this.setStatus('disconnected');
        ws.onerror = () => {
          this.setStatus('error');
          reject(new Error(`WebSocket error: ${url}`));
        };
        this.ws = ws;
      } catch (err) {
        this.setStatus('error');
        reject(err);
      }
    });
  }

  /** True if the queue is too full to send right now — fires
   *  onQueueOverflow as a side effect when it is (once per call, not once
   *  per throttled frame, so callers aren't flooded either). */
  private isThrottled(): boolean {
    if (!this.ws || this.ws.bufferedAmount <= this.maxBufferedBytes) return false;
    this.onQueueOverflow?.(this.ws.bufferedAmount);
    return true;
  }

  sendText(text: string): boolean {
    if (!this.ws || this._status !== 'connected' || this.isThrottled()) return false;
    this.ws.send(text);
    return true;
  }

  sendBinary(buf: Uint8Array): boolean {
    if (!this.ws || this._status !== 'connected' || this.isThrottled()) return false;
    this.ws.send(buf);
    return true;
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }
}
