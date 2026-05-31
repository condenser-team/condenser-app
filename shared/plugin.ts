import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

export const PluginConvention = {
  FRONTEND_FILE:  'frontend.tsx',
  FRONTEND_BUILT: 'frontend.js',
  BACKEND_FILE:   'backend.ts',
  BACKEND_BUILT:  'backend.mjs',
  URL_PREFIX:     '/plugins/',
} as const;

export function listPluginIds(pluginsDir: string): string[] {
  if (!existsSync(pluginsDir)) return [];
  return readdirSync(pluginsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && (
      existsSync(join(pluginsDir, d.name, PluginConvention.FRONTEND_FILE)) ||
      existsSync(join(pluginsDir, d.name, PluginConvention.FRONTEND_BUILT))
    ))
    .map(d => d.name);
}
