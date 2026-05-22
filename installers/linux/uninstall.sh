#!/bin/bash
# Uninstall Condenser (manual removal when not using a package manager).
set -e

echo "Stopping Condenser service..."
systemctl --user stop    condenser.service 2>/dev/null || true
systemctl --user disable condenser.service 2>/dev/null || true

echo "Removing service unit..."
rm -f /etc/systemd/user/condenser.service
systemctl daemon-reload 2>/dev/null || true

echo "Removing Condenser files..."
sudo rm -rf /opt/condenser

echo "Condenser uninstalled."
