#!/usr/bin/env node
/**
 * Builds cross-platform self-contained binaries using Node.js SEA
 * (Single Executable Application, stable in Node 22+).
 *
 * For each target platform, downloads the official Node binary from nodejs.org,
 * injects the pre-built SEA blob produced from dist/bundle.mjs, and writes
 * the result to dist/bin/.
 *
 * Uses only Node built-ins: fetch, stream/promises, zlib, child_process.
 */
import { execSync } from 'child_process';
import {
  mkdirSync, writeFileSync, copyFileSync, chmodSync,
  existsSync, createWriteStream,
} from 'fs';
import { pipeline } from 'stream/promises';

const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const nodeVer = process.version.slice(1); // '24.x.x'
const BASE    = `https://nodejs.org/dist/v${nodeVer}`;
const BLOB    = 'dist/sea-prep.blob';
const POSTJECT = 'node_modules/.bin/postject';

const targets = [
  { id: 'linux-x64',   archive: `node-v${nodeVer}-linux-x64.tar.gz`,    bin: 'bin/node',  out: 'dist/bin/condenser-linux-x64',    macho: false, exe: false },
  { id: 'linux-arm64', archive: `node-v${nodeVer}-linux-arm64.tar.gz`,   bin: 'bin/node',  out: 'dist/bin/condenser-linux-arm64',   macho: false, exe: false },
  { id: 'macos-arm64', archive: `node-v${nodeVer}-darwin-arm64.tar.gz`,  bin: 'bin/node',  out: 'dist/bin/condenser-macos-arm64',   macho: true,  exe: false },
  { id: 'macos-x64',   archive: `node-v${nodeVer}-darwin-x64.tar.gz`,    bin: 'bin/node',  out: 'dist/bin/condenser-macos-x64',     macho: true,  exe: false },
  { id: 'win-x64',     archive: `node-v${nodeVer}-win-x64.zip`,           bin: 'node.exe',  out: 'dist/bin/condenser-win-x64.exe',   macho: false, exe: true  },
];

mkdirSync('dist/bin',        { recursive: true });
mkdirSync('dist/_sea/cache', { recursive: true });

// Write and generate the SEA blob from dist/bundle.mjs
writeFileSync('sea-config.json', JSON.stringify({
  main: 'dist/bundle.mjs',
  output: BLOB,
  disableExperimentalSEAWarning: true,
}, null, 2));

console.log('Generating SEA blob...');
execSync('node --experimental-sea-config sea-config.json', { stdio: 'inherit' });

for (const t of targets) {
  console.log(`\nBuilding ${t.out} (node v${nodeVer})...`);

  const stem        = t.archive.replace(/\.(tar\.gz|zip)$/, '');
  const archivePath = `dist/_sea/cache/${t.archive}`;
  const extractDir  = `dist/_sea/${stem}`;
  const nodeBin     = `${extractDir}/${t.bin}`;

  // Download Node binary (cached between runs)
  if (!existsSync(archivePath)) {
    console.log(`  Downloading ${t.archive}...`);
    const res = await fetch(`${BASE}/${t.archive}`);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${t.archive}`);
    await pipeline(res.body, createWriteStream(archivePath));
  }

  // Extract archive
  if (!existsSync(nodeBin)) {
    if (t.exe) {
      execSync(`unzip -q "${archivePath}" -d "dist/_sea/"`, { stdio: 'pipe' });
    } else {
      execSync(`tar xf "${archivePath}" -C "dist/_sea/"`, { stdio: 'pipe' });
    }
  }

  // Copy binary and set permissions
  copyFileSync(nodeBin, t.out);
  if (!t.exe) chmodSync(t.out, 0o755);

  // macOS: strip existing Apple code signature before modifying the binary
  if (t.macho) {
    execSync(`codesign --remove-signature "${t.out}" 2>/dev/null || true`, { stdio: 'pipe' });
  }

  // Inject SEA blob
  const machoFlag = t.macho ? '--macho-segment-name NODE_SEA' : '';
  execSync(
    `"${POSTJECT}" "${t.out}" NODE_SEA_BLOB "${BLOB}" --sentinel-fuse ${FUSE} ${machoFlag}`.trim(),
    { stdio: 'inherit' },
  );

  // macOS: re-sign with ad-hoc identity so Gatekeeper accepts unsigned local builds
  if (t.macho) {
    execSync(`codesign --sign - "${t.out}" 2>/dev/null || true`, { stdio: 'pipe' });
  }

  console.log(`  ✓ ${t.out}`);
}

console.log('\nAll SEA binaries built in dist/bin/');
