import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';
import { getRuntimeConfig, getTlsOptions, getModeFromArg } from '../shared/runtime';
import { PluginConvention, listPluginIds } from '../shared/plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const mode = getModeFromArg(process.argv.slice(2));
const config = getRuntimeConfig(mode);

// Optional extra plugins directory from an external plugin repo during development.
const extraPluginsDir = process.env.CONDENSER_PLUGINS_DIR
  ? path.resolve(process.env.CONDENSER_PLUGINS_DIR)
  : null;

const allPluginsDirs = [
  path.join(projectRoot, 'plugins'),
  ...(extraPluginsDir ? [extraPluginsDir] : []),
];

// Resolve 'react', 'react/jsx-runtime', and 'condenser:api' to shim modules
// so plugin code uses Steam's webpack-bundled React without bundling it.
const condenserShims: Plugin = {
  name: 'condenser-shims',
  enforce: 'pre',
  resolveId(id) {
    if (id === 'react') return path.join(__dirname, 'library/react.ts');
    if (id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') return path.join(__dirname, 'library/react-jsx.ts');
    if (id.startsWith('condenser:')) {
      const sub = id.slice('condenser:'.length); // 'api', 'nav', 'css', 'ui', 'plugin', 'steam', 'events'
      const fileMap: Record<string, string> = {
        api:    'api',
        nav:    'nav',
        plugin: 'plugin',
        ui:     'ui',
        css:    'css',
        steam:  'steam-api',  // avoids collision with internal steam.ts webpack utilities
        events: 'events',
      };
      const file = fileMap[sub] ?? sub;
      return path.join(__dirname, `library/${file}.ts`);
    }
    return null;
  },
  configureServer(server) {
    if (extraPluginsDir) {
      server.watcher.add(extraPluginsDir);
      // Vite maps /plugins/<id>/... to <root>/plugins/<id>/... which only works for
      // built-in plugins.  For external plugins we rewrite to /@fs<absolute-path>
      // so Vite's transform pipeline finds and compiles the actual file.
      server.middlewares.use((req, _res, next) => {
        if (!req.url?.startsWith(PluginConvention.URL_PREFIX)) return next();
        const qIdx = req.url.indexOf('?');
        const urlPath = qIdx === -1 ? req.url : req.url.slice(0, qIdx);
        const qs     = qIdx === -1 ? '' : req.url.slice(qIdx);
        const rel    = urlPath.slice(PluginConvention.URL_PREFIX.length); // '<id>/filename'
        const sep    = rel.indexOf('/');
        if (sep === -1) return next();
        const externalFile = path.join(extraPluginsDir, rel.slice(0, sep), rel.slice(sep + 1));
        if (existsSync(externalFile)) req.url = `/@fs${externalFile}${qs}`;
        next();
      });
    }
  },
  handleHotUpdate({ file, server }) {
    for (const dir of allPluginsDirs) {
      if (!file.startsWith(dir + path.sep)) continue;
      const rel = path.relative(dir, file);
      const parts = rel.split(path.sep);
      if (parts.length < 2 || path.basename(file) !== PluginConvention.FRONTEND_FILE) return;
      const pluginId = parts[0];
      server.hot.send({ type: 'custom', event: 'condenser:plugin-updated', data: { id: pluginId, url: `${PluginConvention.URL_PREFIX}${pluginId}/${PluginConvention.FRONTEND_FILE}` } });
      return [];
    }
  },
};

// Build entry points: boot.ts + one per plugin frontend.tsx
function getPluginEntries(): Record<string, string> {
  const entries: Record<string, string> = {
    'frontend/index': path.join(__dirname, 'index.ts'),
  };
  for (const dir of allPluginsDirs) {
    for (const id of listPluginIds(dir)) {
      entries[`plugins/${id}/frontend`] = path.join(dir, id, PluginConvention.FRONTEND_FILE);
    }
  }
  return entries;
}

export default defineConfig({
  plugins: [
    condenserShims,
  ],
  build: {
    minify: false,
    outDir: path.join(__dirname, '..', 'dist'),
    rollupOptions: {
      input: getPluginEntries(),
      preserveEntrySignatures: 'exports-only',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '_chunks/[name]-[hash].js',
        format: 'es',
      },
    },
  },
  define: {
    CONDENSER_URL: JSON.stringify(config.backendWsOrigin),
    CONDENSER_DEBUG: config.enableDebugLogs,
  },
  server: {
    port: config.frontendPort,
    host: config.bindHost,
    https: getTlsOptions(mode),
    cors: {
      origin: config.allowedOrigins,
    },
    allowedHosts: config.allowedHosts,
    fs: {
      allow: [projectRoot, ...(extraPluginsDir ? [extraPluginsDir] : [])],
    },
    hmr: {
      protocol: config.certPath ? 'wss' : 'ws',
      host: config.publicHost,
      port: config.frontendPort,
      overlay: false,
    },
  },
});
