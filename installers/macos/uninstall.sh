#!/bin/bash
# Uninstall Condenser: stop the service and remove all files.
set -e

# Resolve the actual logged-in user even when this script runs as root via sudo.
LOGGED_IN_USER=$(stat -f "%Su" /dev/console 2>/dev/null || echo "${SUDO_USER:-$USER}")
USER_UID=$(id -u "$LOGGED_IN_USER")
USER_HOME=$(eval echo "~$LOGGED_IN_USER")
PLIST="$USER_HOME/Library/LaunchAgents/com.condenser.plist"

echo "Stopping Condenser service..."
# bootout works without the plist file and is the modern replacement for unload.
launchctl bootout "gui/$USER_UID/com.condenser" 2>/dev/null || \
  sudo -u "$LOGGED_IN_USER" launchctl unload -w "$PLIST" 2>/dev/null || true
rm -f "$PLIST"

echo "Removing Condenser files..."
sudo rm -rf /usr/local/share/condenser
sudo rm -f /usr/local/bin/condenser
sudo rm -rf "/Applications/Condenser (uninstall).app"

echo "Condenser uninstalled."
