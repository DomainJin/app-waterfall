// Minimal WebSocket client to the valve controller (ws://ip:3333).
// Sends JSON text commands and binary frames. The chunked, queue-aware binary
// streaming (handoff §6) is Phase 7 — this is just connect + send + status.

export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export class ValveSocket {
  private ws: WebSocket | null = null;
  private _status: SocketStatus = 'disconnected';

  constructor(private readonly onStatus?: (s: SocketStatus) => void) {}

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
        const ws = new WebSocket(url);
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

  sendText(text: string): boolean {
    if (this.ws && this._status === 'connected') {
      this.ws.send(text);
      return true;
    }
    return false;
  }

  sendBinary(buf: Uint8Array): boolean {
    if (this.ws && this._status === 'connected') {
      this.ws.send(buf);
      return true;
    }
    return false;
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }
}
