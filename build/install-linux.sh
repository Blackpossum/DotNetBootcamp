#!/usr/bin/env bash
#
# Per-user install for Linux — builds a self-contained binary and registers the
# app with your desktop so it shows up in the applications menu with an icon and
# launches like any other Linux app. No root required. Mirrors Install.ps1.
#
#   ./build/install-linux.sh
#
# Uninstall with ./build/uninstall-linux.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$REPO_ROOT/linux/DotNetBootcamp.Desktop.csproj"

APP_ID="dotnet-bootcamp"
APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/$APP_ID"
BIN_DIR="${HOME}/.local/bin"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICON_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor"

command -v dotnet >/dev/null 2>&1 || { echo "error: .NET SDK (dotnet) not found on PATH." >&2; exit 1; }

echo "==> Publishing self-contained build (linux-x64)…"
PUBLISH_DIR="$REPO_ROOT/dist/linux-x64"
rm -rf "$PUBLISH_DIR"
dotnet publish "$PROJECT" -c Release -r linux-x64 --self-contained true \
    -p:PublishSingleFile=false -o "$PUBLISH_DIR"

echo "==> Installing application files to $APP_DIR"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"
cp -r "$PUBLISH_DIR"/. "$APP_DIR/"
chmod +x "$APP_DIR/$APP_ID"

echo "==> Linking launcher into $BIN_DIR"
mkdir -p "$BIN_DIR"
ln -sf "$APP_DIR/$APP_ID" "$BIN_DIR/$APP_ID"

echo "==> Installing icons"
if command -v magick >/dev/null 2>&1 && [ -f "$REPO_ROOT/app.ico" ]; then
    # Resize the 256px frame of app.ico ([6]) down into each hicolor size.
    # (Selecting one frame avoids magick emitting one PNG per embedded frame.)
    for size in 16 24 32 48 64 128 256; do
        dir="$ICON_ROOT/${size}x${size}/apps"
        mkdir -p "$dir"
        magick "$REPO_ROOT/app.ico[6]" -resize "${size}x${size}" "$dir/$APP_ID.png" 2>/dev/null \
            || cp "$REPO_ROOT/linux/Assets/icon.png" "$dir/$APP_ID.png"
    done
else
    dir="$ICON_ROOT/256x256/apps"
    mkdir -p "$dir"
    cp "$REPO_ROOT/linux/Assets/icon.png" "$dir/$APP_ID.png"
fi

echo "==> Writing desktop entry"
mkdir -p "$DESKTOP_DIR"
cat > "$DESKTOP_DIR/$APP_ID.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=.NET Bootcamp
GenericName=.NET 10 / C# 14 Course
Comment=Offline bootcamp for .NET 10 and C# 14 — 12 modules, 53 lessons
Exec=$APP_DIR/$APP_ID
Icon=$APP_ID
Terminal=false
Categories=Education;Development;
Keywords=dotnet;csharp;.net;programming;course;learning;
StartupWMClass=$APP_ID
StartupNotify=true
EOF
chmod +x "$DESKTOP_DIR/$APP_ID.desktop"

# Refresh desktop/icon caches so the entry appears without a re-login.
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -f -t "$ICON_ROOT" 2>/dev/null || true

echo
echo "Installed. '.NET Bootcamp' is now in your applications menu."
echo "You can also launch it from a terminal with:  $APP_ID"
echo "(If ~/.local/bin isn't on your PATH, run it as: $APP_DIR/$APP_ID)"
