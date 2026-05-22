import path from 'path';
import { PluginConvention, listPluginIds } from '../../shared/plugin.js';

const IS_PROD = process.env.NODE_ENV === 'production';

// Dev:  <cwd>/plugins/<id>/frontend.tsx  (source tree)
// Prod: <cwd>/dist/plugins/<id>/frontend.js  (Vite build output, served statically)
export const pluginsDir: string = IS_PROD
  ? path.join(process.cwd(), 'dist', 'plugins')
  : path.join(process.cwd(), 'plugins');

export interface PluginEntry {
  id: string;
  path: string;
  vitePath: string;
}

export function discoverPlugins(): PluginEntry[] {
  const entryFile = IS_PROD ? PluginConvention.FRONTEND_BUILT : PluginConvention.FRONTEND_FILE;
  return listPluginIds(pluginsDir).map(id => ({
    id,
    path: path.join(pluginsDir, id, entryFile),
    vitePath: `${PluginConvention.URL_PREFIX}${id}/${PluginConvention.FRONTEND_FILE}`,
  }));
}
