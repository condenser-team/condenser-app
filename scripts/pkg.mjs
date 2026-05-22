#!/usr/bin/env node
// Builds cross-platform binaries from dist/bundle.cjs using @yao-pkg/pkg.
import { execSync } from 'child_process';
import { mkdirSync } from 'fs';

const targets = [
  { target: 'node20-macos-arm64', output: 'dist/bin/condenser-macos-arm64' },
  { target: 'node20-macos-x64',   output: 'dist/bin/condenser-macos-x64' },
  { target: 'node20-linux-x64',   output: 'dist/bin/condenser-linux-x64' },
  { target: 'node20-linux-arm64', output: 'dist/bin/condenser-linux-arm64' },
  { target: 'node20-win-x64',     output: 'dist/bin/condenser-win-x64.exe' },
];

mkdirSync('dist/bin', { recursive: true });

for (const { target, output } of targets) {
  console.log(`Building ${output} ...`);
  execSync(
    `npx pkg dist/bundle.cjs --target ${target} --output ${output} --config package.json`,
    { stdio: 'inherit' },
  );
}

console.log('All binaries built in dist/bin/');
