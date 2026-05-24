#!/bin/bash
# Stop and disable Condenser before files are removed.
set -e

if command -v loginctl &>/dev/null; then
  for uid in $(loginctl list-users --no-legend | awk '{print $1}'); do
    user=$(id -nu "$uid" 2>/dev/null) || continue
    systemctl --user -M "$user@" stop    condenser.service 2>/dev/null || true
    systemctl --user -M "$user@" disable condenser.service 2>/dev/null || true
  done
fi
