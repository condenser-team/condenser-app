#!/usr/bin/env node
// Compiles each plugin's backend.ts to a self-contained CJS bundle for production.
import { execSync } from 'child_process';
import { mkdirSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const pluginsDir = 'plugins';
if (!existsSync(pluginsDir)) process.exit(0);

let built = 0;
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
console.log(built ? `Built ${built} plugin backend(s).` : 'No plugin backends to build.');
