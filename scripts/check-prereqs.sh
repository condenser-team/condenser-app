#!/usr/bin/env bash
# check-prereqs.sh - validate that required tools are installed before setup
# exits 0 if everything looks good, 1 with actionable instructions otherwise
set -euo pipefail

ERRORS=0

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "MISSING: $1 - $2"
    ERRORS=$((ERRORS + 1))
    return 1
  fi
  return 0
}

echo "Checking prerequisites..."

# node 20+
if check_cmd node "Install Node.js 20+ from https://nodejs.org/"; then
  NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "OUTDATED: node v$(node --version) found, need 20+."
    ERRORS=$((ERRORS + 1))
  else
    echo "  node $(node --version)"
  fi
fi

check_cmd npm "Should come with Node.js" && echo "  npm $(npm --version)"

# mkcert
if ! check_cmd mkcert "Required for HTTPS dev certs"; then
  # give distro-specific install advice
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "${ID:-}" in
      ubuntu|pop|linuxmint|debian)
        echo "  FIX: sudo apt install -y libnss3-tools mkcert" ;;
      fedora)
        echo "  FIX: sudo dnf install -y nss-tools mkcert" ;;
      arch|manjaro|endeavouros)
        echo "  FIX: sudo pacman -S --noconfirm mkcert nss" ;;
      *)
        echo "  FIX: see https://github.com/FiloSottile/mkcert#installation" ;;
    esac
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  FIX: brew install mkcert"
  fi
else
  # verify it's a real binary, not a broken download
  if ! mkcert --version &>/dev/null; then
    echo "BROKEN: mkcert exists but doesn't run. Reinstall it."
    ERRORS=$((ERRORS + 1))
  else
    echo "  mkcert $(mkcert --version 2>&1)"
  fi
fi

# libnss3/certutil for browser trust store on Linux
if [[ "$OSTYPE" == "linux"* ]]; then
  if ! command -v certutil &>/dev/null; then
    echo "MISSING: certutil (libnss3-tools) - needed for browser certificate trust"
    if [ -f /etc/os-release ]; then
      . /etc/os-release
      case "${ID:-}" in
        ubuntu|pop|linuxmint|debian) echo "  FIX: sudo apt install -y libnss3-tools" ;;
        fedora) echo "  FIX: sudo dnf install -y nss-tools" ;;
        arch|manjaro|endeavouros) echo "  FIX: sudo pacman -S --noconfirm nss" ;;
      esac
    fi
    ERRORS=$((ERRORS + 1))
  else
    echo "  certutil (libnss3-tools) installed"
  fi
fi

# nfpm is only needed for building .deb/.rpm installers, not for dev
if command -v nfpm &>/dev/null; then
  echo "  nfpm $(nfpm --version 2>&1) (for installer builds)"
else
  echo "  nfpm not installed (optional, only needed for build:installer)"
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "Found $ERRORS issue(s). Fix them and re-run."
  exit 1
else
  echo "All prerequisites met."
fi
