import path from 'path';
import { PluginConvention, listPluginIds } from '../../shared/plugin.js';

const IS_PROD = process.env.NODE_ENV === 'production';

// Dev:  <cwd>/plugins/<id>/frontend.tsx  (source tree)
// Prod: <cwd>/dist/plugins/<id>/frontend.js  (Vite build output, served statically)
const builtinDir: string = IS_PROD
  ? path.join(process.cwd(), 'dist', 'plugins')
  : path.join(process.cwd(), 'plugins');

export const pluginsDir = builtinDir;

export const pluginsDirs: string[] = [
  builtinDir,
  ...(process.env.CONDENSER_PLUGINS_DIR ? [path.resolve(process.env.CONDENSER_PLUGINS_DIR)] : []),
];

export interface PluginEntry {
  id: string;
  path: string;
  vitePath: string;
}

export function discoverPlugins(): PluginEntry[] {
  const entryFile = IS_PROD ? PluginConvention.FRONTEND_BUILT : PluginConvention.FRONTEND_FILE;
  return pluginsDirs.flatMap(dir =>
    listPluginIds(dir).map(id => ({
      id,
      path: path.join(dir, id, entryFile),
      vitePath: `${PluginConvention.URL_PREFIX}${id}/${PluginConvention.FRONTEND_FILE}`,
    })),
  );
}
