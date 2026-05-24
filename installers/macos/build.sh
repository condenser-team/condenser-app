#!/bin/bash
# Build a macOS .pkg installer.
# Usage: bash installers/macos/build.sh <arch> <version>
#   arch:    arm64 | x64
#   version: e.g. 1.0.0
set -e

ARCH="${1:?arch required (arm64|x64)}"
VERSION="${2:?version required}"
BINARY="dist/bin/condenser-macos-$ARCH"
INSTALL_DIR="/usr/local/share/condenser"
OUTPUT="dist/installers/condenser-${VERSION}-macos-${ARCH}.pkg"

mkdir -p dist/installers

# Build payload directory tree matching install paths
PAYLOAD="dist/macos-payload-$ARCH"
rm -rf "$PAYLOAD"
mkdir -p "$PAYLOAD/usr/local/share/condenser"
mkdir -p "$PAYLOAD/usr/local/bin"

# Binary
cp "$BINARY" "$PAYLOAD/usr/local/share/condenser/condenser"
chmod +x "$PAYLOAD/usr/local/share/condenser/condenser"

# Symlink helper (pkgbuild cannot create symlinks directly; do it in postinstall)

# Frontend build output
mkdir -p "$PAYLOAD/usr/local/share/condenser/dist"
cp -r dist/frontend "$PAYLOAD/usr/local/share/condenser/dist/frontend" 2>/dev/null || true
cp -r dist/plugins  "$PAYLOAD/usr/local/share/condenser/dist/plugins"  2>/dev/null || true
cp -r dist/_chunks  "$PAYLOAD/usr/local/share/condenser/dist/_chunks"  2>/dev/null || true

# Service config and helper scripts
cp installers/macos/com.condenser.plist "$PAYLOAD/usr/local/share/condenser/"
cp installers/macos/uninstall.sh "$PAYLOAD/usr/local/share/condenser/"
chmod +x "$PAYLOAD/usr/local/share/condenser/uninstall.sh"

# GUI uninstaller app
mkdir -p "$PAYLOAD/Applications"
cp -r installers/macos/uninstaller-app "$PAYLOAD/Applications/Condenser (uninstall).app"
chmod +x "$PAYLOAD/Applications/Condenser (uninstall).app/Contents/MacOS/uninstall"

# Ensure postinstall is executable
chmod +x installers/macos/scripts/postinstall
chmod +x installers/macos/scripts/preremove

pkgbuild \
  --root "$PAYLOAD" \
  --identifier "com.condenser" \
  --version "$VERSION" \
  --scripts "installers/macos/scripts" \
  "$OUTPUT"

rm -rf "$PAYLOAD"
echo "Created: $OUTPUT"
