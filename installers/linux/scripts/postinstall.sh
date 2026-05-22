#!/bin/bash
# Enable and start the Condenser systemd user service.
# Runs as the package-manager process (may be root); use loginctl to enumerate users.
set -e

# Enable for all logged-in users with an active session
if command -v loginctl &>/dev/null; then
  for uid in $(loginctl list-users --no-legend | awk '{print $1}'); do
    user=$(id -nu "$uid" 2>/dev/null) || continue
    home=$(getent passwd "$uid" | cut -d: -f6) || continue
    export XDG_RUNTIME_DIR="/run/user/$uid"
    systemctl --user -M "$user@" enable condenser.service 2>/dev/null || true
    systemctl --user -M "$user@" start  condenser.service 2>/dev/null || true
  done
fi

echo "Condenser service installed."
echo "Logs: journalctl --user -u condenser"
echo "To uninstall: /opt/condenser/uninstall.sh  (or use your package manager)"
