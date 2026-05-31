import path from 'path';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import WebSocket, { WebSocketServer } from 'ws';
import { createServer as createHttpsServer } from 'https';
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'http';
import { createLogger } from '../../shared/logger.js';
import { getRuntimeConfig, getTlsOptions, Mode } from '../../shared/runtime.js';
import { Route, Auth } from '../../shared/protocol.js';
import { discoverPlugins, userPluginsDir } from './plugins.js';
import { WsRouter } from './ws-router.js';
import { loadPlugins } from './plugin-loader.js';

const MIME: Record<string, string> = {
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.map':  'application/json',
};

export async function startServer(mode: Mode) {
  const config = getRuntimeConfig(mode);
  const logger = createLogger('server', config.enableDebugLogs);
  const sslOptions = getTlsOptions(mode);
  const csrfToken = randomUUID();
  const clients = new Set<WebSocket>();
  const router = new WsRouter(logger);

  router.register(Route.GET_PLUGINS, () =>
    discoverPlugins().map(c => ({
      id: c.id,
      url: config.isProduction
        ? `${config.frontendOrigin}${c.vitePath.replace(/\.tsx$/, '.js')}`
        : `${config.frontendOrigin}${c.vitePath}`,
    })),
  );

  await loadPlugins(router, clients);

  const handleRequest = createRequestHandler(csrfToken, config.isProduction);

  const server = sslOptions
    ? createHttpsServer(sslOptions, handleRequest)
    : createHttpServer(handleRequest);

  const wss = new WebSocketServer({ server });

  server.listen(config.backendPort, config.bindHost, () => {
    logger.info(`Server.started (${sslOptions ? 'WSS' : 'WS'})`, config.backendWsOrigin);
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    if (!isAllowedRequest(request, config.allowedOrigins)) {
      logger.warn('Rejected websocket connection', request.headers.origin ?? 'no-origin');
      ws.close(1008, 'Origin not allowed');
      return;
    }

    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.searchParams.get(Auth.QUERY_PARAM) !== csrfToken) {
      logger.warn('Rejected websocket connection: invalid auth token');
      ws.close(1008, 'Unauthorized');
      return;
    }

    logger.debug('Server.connection', request.headers.origin ?? 'no-origin');
    clients.add(ws);

    ws.on('message', async (data: any) => {
      logger.debug('Server.message', data.toString());
      await router.handle(data.toString(), ws);
    });

    ws.on('close', () => {
      logger.debug('Server.close');
      clients.delete(ws);
    });
  });
}

function isAllowedRequest(request: IncomingMessage, allowedOrigins: string[]): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

function serveFile(filePath: string, res: ServerResponse): boolean {
  const ext = path.extname(filePath);
  if (!ext || !existsSync(filePath)) return false;
  const contentType = MIME[ext] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
  createReadStream(filePath).pipe(res);
  return true;
}

function createRequestHandler(csrfToken: string, isProduction: boolean) {
  return (req: IncomingMessage, res: ServerResponse) => {
    if (req.url === Auth.ENDPOINT) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ [Auth.TOKEN_KEY]: csrfToken }));
      return;
    }

    if (isProduction) {
      const safePath = (req.url ?? '/').replace(/[?#].*$/, '');

      // Built-in plugins and frontend assets served from dist/
      if (serveFile(path.join(process.cwd(), 'dist', safePath), res)) return;

      // User-installed plugins served from ~/.condenser/plugins/{id}/{file}
      const parts = safePath.split('/').filter(Boolean); // ['plugins', 'id', 'filename']
      if (parts.length === 3 && parts[0] === 'plugins') {
        const [, id, filename] = parts;
        if (serveFile(path.join(userPluginsDir, id, filename), res)) return;
      }
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Condenser Backend');
  };
}
