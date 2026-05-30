#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_SRC="$ROOT_DIR/products/cursor-extension"
CURSOR_EXT_DIR="$HOME/.cursor/extensions"
EXT_ID_DIR="local.ai-traffic-lights-cursor-extension-0.1.5"
EXT_DST="$CURSOR_EXT_DIR/$EXT_ID_DIR"

echo "[1/4] Copying image assets..."
bash "$ROOT_DIR/tools/copy-extension-assets.sh"

echo "[2/4] Building shared packages + extension..."
cd "$ROOT_DIR"
npm run prepare:cursor-extension

echo "[3/4] Installing extension into Cursor extensions directory..."
mkdir -p "$EXT_DST"
rm -rf "$EXT_DST"/*

cp "$EXT_SRC/package.json" "$EXT_DST/package.json"
cp -R "$EXT_SRC/dist" "$EXT_DST/dist"

mkdir -p "$EXT_DST/resources/image"
cp -R "$EXT_SRC/resources/image/"* "$EXT_DST/resources/image/"

echo "[4/4] Done."
echo "Installed to: $EXT_DST"
echo "Next: reload Cursor window, then open Command Palette and run 'View: Open View...' -> 'Status Lights'."
