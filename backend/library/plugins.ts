import path from 'path';
import { fileURLToPath } from 'url';
import { PluginConvention, listPluginIds } from '../../shared/plugin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface PluginEntry {
  id: string;
  path: string;
  vitePath: string;
}

export const pluginsDir: string = path.join(__dirname, '..', '..', 'plugins');

export function discoverPlugins(): PluginEntry[] {
  return listPluginIds(pluginsDir).map(id => ({
    id,
    path: path.join(pluginsDir, id, PluginConvention.FRONTEND_FILE),
    vitePath: `${PluginConvention.URL_PREFIX}${id}/${PluginConvention.FRONTEND_FILE}`,
  }));
}
