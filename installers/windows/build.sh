#!/bin/bash
# Build the Windows NSIS installer.
# Usage: bash installers/windows/build.sh <version>
# Requires: makensis (pre-installed on GitHub windows-latest runner)
set -e

VERSION="${1:?version required}"
mkdir -p dist/installers

makensis \
  -DVERSION="$VERSION" \
  installers/windows/installer.nsi

echo "Created: dist/installers/condenser-${VERSION}-windows-x64.exe"
