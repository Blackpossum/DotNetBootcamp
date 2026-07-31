#!/usr/bin/env bash
#
# Removes the per-user Linux install created by install-linux.sh.
# Your progress (saved in the WebKit data store) is left untouched.
#
#   ./build/uninstall-linux.sh
#
set -euo pipefail

APP_ID="dotnet-bootcamp"
APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/$APP_ID"
BIN_DIR="${HOME}/.local/bin"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICON_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor"

echo "==> Removing application files"
rm -rf "$APP_DIR"
rm -f "$BIN_DIR/$APP_ID"

echo "==> Removing desktop entry and icons"
rm -f "$DESKTOP_DIR/$APP_ID.desktop"
for size in 16 24 32 48 64 128 256; do
    rm -f "$ICON_ROOT/${size}x${size}/apps/$APP_ID.png"
done

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -f -t "$ICON_ROOT" 2>/dev/null || true

echo
echo "Uninstalled. (Saved progress in the WebKit data store was kept.)"
