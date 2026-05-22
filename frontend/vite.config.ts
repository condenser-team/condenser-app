import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';
import { getRuntimeConfig, getTlsOptions, getModeFromArg } from '../shared/runtime';
import { PluginConvention, listPluginIds } from '../shared/plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const mode = getModeFromArg(process.argv.slice(2));
const config = getRuntimeConfig(mode);

// Resolve 'react', 'react/jsx-runtime', and 'condenser:api' to shim modules
// so plugin code uses Steam's webpack-bundled React without bundling it.
const condenserShims: Plugin = {
  name: 'condenser-shims',
  enforce: 'pre',
  resolveId(id) {
    if (id === 'react') return path.join(__dirname, 'library/react.ts');
    if (id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') return path.join(__dirname, 'library/react-jsx.ts');
    if (id === 'condenser:api') return path.join(__dirname, 'library/api.ts');
    return null;
  },
  handleHotUpdate({ file, server }) {
    if (!file.startsWith(path.join(projectRoot, 'plugins') + path.sep)) return;
    const rel = path.relative(path.join(projectRoot, 'plugins'), file);
    const parts = rel.split(path.sep);
    if (parts.length < 2 || path.basename(file) !== PluginConvention.FRONTEND_FILE) return;
    const pluginId = parts[0];
    server.hot.send({ type: 'custom', event: 'condenser:plugin-updated', data: { id: pluginId, url: `${PluginConvention.URL_PREFIX}${pluginId}/${PluginConvention.FRONTEND_FILE}` } });
    return [];
  },
};

// Build entry points: boot.ts + one per plugin frontend.tsx
function getPluginEntries(): Record<string, string> {
  const pluginsDir = path.join(projectRoot, 'plugins');
  const entries: Record<string, string> = {
    'frontend/index': path.join(__dirname, 'index.ts'),
  };
  for (const id of listPluginIds(pluginsDir)) {
    entries[`plugins/${id}/frontend`] = path.join(pluginsDir, id, PluginConvention.FRONTEND_FILE);
  }
  return entries;
}

export default defineConfig({
  plugins: [
    condenserShims,
  ],
  build: {
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
    hmr: {
      protocol: config.certPath ? 'wss' : 'ws',
      host: config.publicHost,
      port: config.frontendPort,
      overlay: false,
    },
  },
});
