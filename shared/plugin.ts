import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

export const PluginConvention = {
  FRONTEND_FILE: 'frontend.tsx',
  BACKEND_FILE:  'backend.ts',
  URL_PREFIX:    '/plugins/',
} as const;

export function listPluginIds(pluginsDir: string): string[] {
  if (!existsSync(pluginsDir)) return [];
  return readdirSync(pluginsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(pluginsDir, d.name, PluginConvention.FRONTEND_FILE)))
    .map(d => d.name);
}
