import WebSocket from 'ws';
import { MessageType } from '../../shared/protocol.js';
import type { Logger } from '../../shared/logger.js';

export { MessageType };

type Handler = (params: unknown, ws: WebSocket) => Promise<unknown> | unknown;

function sendReply(ws: WebSocket, id: unknown, payload: { result: unknown } | { error: string }): void {
  ws.send(JSON.stringify({ type: MessageType.REPLY, id, ...payload }));
}

export class WsRouter {
  private readonly routes = new Map<string, Handler>();
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  register(route: string, handler: Handler): this {
    this.routes.set(route, handler);
    return this;
  }

  async handle(raw: string, ws: WebSocket): Promise<void> {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type !== MessageType.CALL) return;

    const handler = this.routes.get(msg.route);
    if (!handler) {
      sendReply(ws, msg.id, { error: `Unknown route: ${msg.route}` });
      this.logger?.warn(`→ ${msg.route} (unknown route)`);
      return;
    }
    try {
      const result = await handler(msg.params, ws);
      this.logger?.info(`→ ${msg.route}`, JSON.stringify(msg.params ?? null));
      sendReply(ws, msg.id, { result });
      this.logger?.info(`← ${msg.route}`, JSON.stringify(result));
    } catch (e: any) {
      this.logger?.warn(`← ${msg.route} ERROR:`, e.message);
      sendReply(ws, msg.id, { error: e.message });
    }
  }
}

export function broadcastEvent(
  clients: Set<WebSocket>,
  event: string,
  payload: Record<string, unknown> = {},
): void {
  const data = JSON.stringify({ type: MessageType.EVENT, event, ...payload });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}
