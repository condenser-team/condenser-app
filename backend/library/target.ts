import * as fs from 'fs';
import * as path from 'path';
import WebSocket from 'ws';
import { createLogger } from '../../shared/logger.js';
import { getRuntimeConfig, Mode } from '../../shared/runtime.js';
import { discoverPlugins, pluginsDir } from './plugins.js';

const RECONNECT_INTERVAL_MS = 5_000;

const STEAM_SHARED_CONTEXT_TITLES = new Set([
  'SharedJSContext',
  'Steam Shared Context presented by Valve™',
  'Steam',
  'SP',
]);

export function isSteamSharedContextTab(title: string, url: string): boolean {
  return (
    (url.includes('https://steamloopback.host/routes/') ||
      url.includes('https://steamloopback.host/index.html')) &&
    STEAM_SHARED_CONTEXT_TITLES.has(title)
  );
}

interface CdpTargetInfo {
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
}

type CdpEventHandler = (params: unknown) => void;

class CdpSession {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();
  private eventHandlers = new Map<string, Set<CdpEventHandler>>();

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as {
        id?: number; method?: string; params?: unknown;
        result?: unknown; error?: { message: string };
      };
      if (msg.id !== undefined) {
        const handler = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) handler?.reject(new Error(msg.error.message));
        else handler?.resolve(msg.result);
      } else if (msg.method) {
        this.eventHandlers.get(msg.method)?.forEach(h => h(msg.params));
      }
    });
  }

  send(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
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
}

function makeBootScript(frontendOrigin: string, wsUrl: string, isProduction = false): string {
  const ext = isProduction ? '.js' : '.ts';
  const bootUrl = `${frontendOrigin}/frontend/index${ext}`;
  return `(async () => {
    const c = (window.__condenser ||= { core: {}, components: {} });
    c.core.url = ${JSON.stringify(wsUrl)};
    await import(${JSON.stringify(bootUrl)} + '?t=' + Date.now());
  })()`;
}

function makeReloadScript(id: string, pluginUrl: string): string {
  return `(async () => {
    const c = window.__condenser;
    if (c?.plugins?.loadPlugin) {
      await c.plugins.loadPlugin(${JSON.stringify(id)}, ${JSON.stringify(pluginUrl)} + '?t=' + Date.now());
    }
  })()`;
}

function watchPluginChanges(
  session: CdpSession,
  frontendOrigin: string,
  logger: ReturnType<typeof createLogger>,
): void {
  const componentsByDir = new Map(discoverPlugins().map(c => [c.id, c]));
  if (!fs.existsSync(pluginsDir)) return;
  fs.watch(pluginsDir, { recursive: true }, async (_, filename) => {
    if (!filename || (!filename.endsWith('.tsx') && !filename.endsWith('.ts'))) return;
    const pluginId = filename.split(path.sep)[0];
    const component = componentsByDir.get(pluginId);
    if (!component) return;
    const pluginUrl = `${frontendOrigin}${component.vitePath}`;
    logger.info('[reload]', component.id);
    try {
      await session.send('Runtime.evaluate', {
        expression: makeReloadScript(component.id, pluginUrl),
        userGesture: true,
        awaitPromise: false,
      });
    } catch (e) { logger.error('[reload error]', (e as Error).message); }
  });
}

async function setupSession(
  session: CdpSession,
  frontendOrigin: string,
  websocketUrl: string,
  isProduction: boolean,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const setupResult = await session.send('Runtime.evaluate', {
    expression: `(() => {
      const c = (window.__condenser ||= { core: {}, components: {} });
      if (c.core.setup) return true;
      c.core.setup = true;
      return false;
    })()`,
    returnByValue: true,
  }).catch(() => null) as any;
  if (setupResult?.result?.value === true) return;

  await session.send('Runtime.enable');
  session.on('Runtime.consoleAPICalled', (event: any) => {
    const text = (event.args as any[])
      .map((a: any) => (typeof a.value !== 'undefined' ? String(a.value) : (a.description ?? '')))
      .join(' ');
    logger.info('[browser]', text);
  });

  void session.send('Page.setBypassCSP', { enabled: true });

  const bootExt = isProduction ? '.js' : '.ts';
  logger.info('Booting via', `${frontendOrigin}/frontend/index${bootExt}`);
  await session.send('Runtime.evaluate', {
    expression: makeBootScript(frontendOrigin, websocketUrl, isProduction),
    userGesture: true,
    awaitPromise: false,
  }).catch((e: Error) => logger.error('Boot error:', e.message));

  logger.info('Watching for changes...');
  watchPluginChanges(session, frontendOrigin, logger);

  await session.send('Page.enable');
  session.on('Page.loadEventFired', async () => {
    const result = await session.send('Runtime.evaluate', {
      expression: '!!(window.__condenser?.core?.injected)',
      returnByValue: true,
    }).catch(() => null) as any;
    if (result?.result?.value) return;

    await session.send('Runtime.evaluate', {
      expression: 'if (window.__condenser) window.__condenser.core.setup = false;',
      awaitPromise: false,
    }).catch(() => {});

    logger.info('Page navigated — reinjecting...');
    await session.send('Runtime.evaluate', {
      expression: makeBootScript(frontendOrigin, websocketUrl, isProduction),
      userGesture: true,
      awaitPromise: false,
    }).catch((e: Error) => logger.error('Reinjection error:', e.message));
  });
}

async function findSteamTarget(
  debugUrls: string[],
  logger: ReturnType<typeof createLogger>,
): Promise<CdpTargetInfo | null> {
  for (const debugUrl of debugUrls) {
    try {
      logger.debug(`Scanning ${debugUrl}...`);
      const response = await fetch(`${debugUrl}/json`);
      if (!response.ok) continue;
      const targets = await response.json() as CdpTargetInfo[];
      const target = targets.find(t => isSteamSharedContextTab(t.title, t.url));
      if (target) {
        logger.info(`Found SharedJSContext: "${target.title}" @ ${target.url}`);
        return target;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function discoverAndSetup(
  config: ReturnType<typeof getRuntimeConfig>,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const target = await findSteamTarget(config.debugTargets, logger);

  if (!target) {
    logger.warn('No SharedJSContext found — launch Steam with -cef-enable-debugging');
    setTimeout(() => discoverAndSetup(config, logger), RECONNECT_INTERVAL_MS);
    return;
  }

  let connected = false;
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => { connected = true; resolve(); });
    ws.once('error', reject);
  }).catch((e: Error) => logger.warn('WebSocket connect failed:', e.message));

  if (!connected) {
    setTimeout(() => discoverAndSetup(config, logger), RECONNECT_INTERVAL_MS);
    return;
  }

  logger.info('Connected to SharedJSContext');
  const session = new CdpSession(ws);

  await setupSession(session, config.frontendOrigin, config.backendWsOrigin, config.isProduction, logger)
    .catch((e: Error) => logger.error('Setup error:', e.message));

  session.onClose(() => {
    logger.info('SharedJSContext disconnected, reconnecting in', RECONNECT_INTERVAL_MS / 1000, 's...');
    setTimeout(() => discoverAndSetup(config, logger), RECONNECT_INTERVAL_MS);
  });
}

export async function startDiscovery(mode: Mode) {
  const config = getRuntimeConfig(mode);
  const logger = createLogger('target', config.enableDebugLogs);
  discoverAndSetup(config, logger);
}
