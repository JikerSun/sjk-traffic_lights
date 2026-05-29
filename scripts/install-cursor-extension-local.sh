#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_SRC="$ROOT_DIR/apps/cursor-extension"
CURSOR_EXT_DIR="$HOME/.cursor/extensions"
EXT_ID_DIR="local.ai-traffic-lights-cursor-extension-0.1.0"
EXT_DST="$CURSOR_EXT_DIR/$EXT_ID_DIR"

echo "[1/3] Building shared packages + extension..."
cd "$ROOT_DIR"
npm run prepare:cursor-extension

echo "[2/3] Installing extension into Cursor extensions directory..."
mkdir -p "$EXT_DST"
rm -rf "$EXT_DST"/*

cp "$EXT_SRC/package.json" "$EXT_DST/package.json"
cp -R "$EXT_SRC/dist" "$EXT_DST/dist"

mkdir -p "$EXT_DST/resources/image"
if [ -d "$ROOT_DIR/image" ]; then
  cp -R "$ROOT_DIR/image/"* "$EXT_DST/resources/image/"
fi
if [ -d "$EXT_SRC/resources" ]; then
  cp -R "$EXT_SRC/resources/"* "$EXT_DST/resources/" 2>/dev/null || true
fi

echo "[3/3] Done."
echo "Installed to: $EXT_DST"
echo "Next: reload Cursor window, then open Command Palette and run 'View: Open View...' -> 'Status Lights'."
