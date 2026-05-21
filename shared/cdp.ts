import WebSocket from 'ws';

type CdpEventHandler = (params: unknown) => void;

interface Pending {
  resolve: (r: unknown) => void;
  reject: (e: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export class CdpSession {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private eventHandlers = new Map<string, Set<CdpEventHandler>>();

  constructor(private ws: WebSocket) {
    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as {
        id?: number; method?: string; params?: unknown;
        result?: unknown; error?: { message: string };
      };
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          clearTimeout(p.timer);
          if (msg.error) p.reject(new Error(msg.error.message));
          else p.resolve(msg.result);
        }
      } else if (msg.method) {
        this.eventHandlers.get(msg.method)?.forEach(h => h(msg.params));
      }
    });
  }

  static connect(wsUrl: string, timeoutMs = 5000): Promise<CdpSession> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error(`CDP connect timed out: ${wsUrl}`));
      }, timeoutMs);
      ws.once('open', () => { clearTimeout(timer); resolve(new CdpSession(ws)); });
      ws.once('error', (e) => { clearTimeout(timer); reject(e); });
    });
  }

  send(method: string, params?: unknown, timeoutMs?: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = timeoutMs
        ? setTimeout(() => {
            this.pending.delete(id);
            reject(new Error(`CDP ${method} timed out`));
          }, timeoutMs)
        : undefined;
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(event: string, handler: CdpEventHandler): void {
    const set = this.eventHandlers.get(event) ?? new Set();
    this.eventHandlers.set(event, set);
    set.add(handler);
  }

  onClose(handler: () => void): void {
    this.ws.once('close', handler);
    this.ws.once('error', handler);
  }

  close(): void {
    this.ws.close();
  }
}
