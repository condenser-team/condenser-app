#!/bin/bash
# Build Linux .deb and .rpm packages using nfpm.
# Usage: bash installers/linux/build.sh <version>
set -e

VERSION="${1:?version required}"
mkdir -p dist/installers

for PACKAGER in deb rpm; do
  for COMBO in "amd64:x64" "arm64:arm64"; do
    ARCH="${COMBO%%:*}"
    ARCH_SUFFIX="${COMBO##*:}"

    # nfpm substitutes ${ARCH}, ${ARCH_SUFFIX}, ${VERSION} from env
    ARCH="$ARCH" ARCH_SUFFIX="$ARCH_SUFFIX" VERSION="$VERSION" \
      nfpm pkg \
        --config installers/linux/nfpm.yaml \
        --packager "$PACKAGER" \
        --target "dist/installers/condenser-${VERSION}-linux-${ARCH}.${PACKAGER}"

    echo "Created: dist/installers/condenser-${VERSION}-linux-${ARCH}.${PACKAGER}"
  done
done
