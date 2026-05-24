#!/usr/bin/env node
// Builds a platform installer for the current OS from the pre-built binaries.
// Requires: pkgbuild (macOS), nfpm (Linux), makensis (Windows).
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';

const cmds = {
  darwin: `bash installers/macos/build.sh ${arch} ${version}`,
  linux:  `bash installers/linux/build.sh ${version}`,
  win32:  `bash installers/windows/build.sh ${version}`,
};

const cmd = cmds[process.platform];
if (!cmd) {
  console.error('Unsupported platform:', process.platform);
  process.exit(1);
}

console.log(`Building installer for ${process.platform}-${arch} v${version} ...`);
execSync(cmd, { stdio: 'inherit' });
