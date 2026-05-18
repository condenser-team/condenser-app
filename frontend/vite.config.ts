import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync } from 'fs';
import { defineConfig, Plugin } from 'vite';
import { getRuntimeConfig, getTlsOptions, getModeFromArg } from '../shared/runtime';
import { PluginConvention } from '../shared/plugin';

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
  const entries: Record<string, string> = {
    'frontend/index': path.join(__dirname, 'index.ts'),
  };
  const pluginsDir = path.join(projectRoot, 'plugins');
  if (existsSync(pluginsDir)) {
    for (const d of readdirSync(pluginsDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const fp = path.join(pluginsDir, d.name, PluginConvention.FRONTEND_FILE);
      if (existsSync(fp)) {
        entries[`plugins/${d.name}/frontend`] = fp;
      }
    }
  }
  return entries;
}

export default defineConfig({
  plugins: [
    condenserShims,
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: getPluginEntries(),
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
      protocol: getRuntimeConfig(mode).certPath ? 'wss' : 'ws',
      host: config.publicHost,
      port: config.frontendPort,
      overlay: false,
    },
  },
});
