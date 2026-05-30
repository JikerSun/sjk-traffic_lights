#!/usr/bin/env bash
# Copy shared image/ assets into the Cursor extension bundle for VSIX packaging.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT_DIR/image"
DST="$ROOT_DIR/products/cursor-extension/resources/image"

required=(
  panel_bg.png
  light_red_on.png
  light_red_off.png
  light_yellow_on.png
  light_yellow_off.png
  light_green_on.png
  light_green_off.png
)

if [ ! -d "$SRC" ]; then
  echo "Missing asset directory: $SRC" >&2
  exit 1
fi

mkdir -p "$DST"
for file in "${required[@]}"; do
  if [ ! -f "$SRC/$file" ]; then
    echo "Missing required asset: $SRC/$file" >&2
    exit 1
  fi
  cp "$SRC/$file" "$DST/$file"
done

echo "Copied ${#required[@]} images -> $DST"
