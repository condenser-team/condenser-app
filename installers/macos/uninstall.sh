#!/bin/bash
# Uninstall Condenser: stop the service and remove all files.
set -e

PLIST="$HOME/Library/LaunchAgents/com.condenser.plist"

echo "Stopping Condenser service..."
launchctl unload -w "$PLIST" 2>/dev/null || true
rm -f "$PLIST"

echo "Removing Condenser files..."
sudo rm -rf /usr/local/share/condenser
sudo rm -f /usr/local/bin/condenser
sudo rm -rf "/Applications/Condenser (uninstall).app"

echo "Condenser uninstalled."
