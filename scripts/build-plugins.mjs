#!/usr/bin/env node
// Compiles each plugin's backend.ts to a self-contained CJS bundle for production.
import { execSync } from 'child_process';
import { mkdirSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const pluginsDirs = [
  'plugins',
  ...(process.env.CONDENSER_PLUGINS_DIR ? [resolve(process.env.CONDENSER_PLUGINS_DIR)] : []),
];

let built = 0;
for (const pluginsDir of pluginsDirs) {
  if (!existsSync(pluginsDir)) continue;
  for (const name of readdirSync(pluginsDir)) {
    const src = join(pluginsDir, name, 'backend.ts');
    if (!existsSync(src)) continue;
    const out = join('dist', 'plugins', name, 'backend.cjs');
    mkdirSync(join('dist', 'plugins', name), { recursive: true });
    console.log(`Building plugin backend: ${name} → ${out}`);
    execSync(
      `npx esbuild ${src} --bundle --platform=node --target=node20 --format=cjs --outfile=${out}`,
      { stdio: 'inherit' },
    );
    built++;
  }
}
console.log(built ? `Built ${built} plugin backend(s).` : 'No plugin backends to build.');
