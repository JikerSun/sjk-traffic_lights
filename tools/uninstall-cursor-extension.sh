#!/usr/bin/env bash
# Remove locally installed AI Traffic Lights extension from Cursor.
set -euo pipefail

EXT_DIR="$HOME/.cursor/extensions"
shopt -s nullglob
matches=("$EXT_DIR"/local.ai-traffic-lights-cursor-extension-*)

if [ ${#matches[@]} -eq 0 ]; then
  echo "No local AI Traffic Lights extension directory found under $EXT_DIR"
  exit 0
fi

for path in "${matches[@]}"; do
  echo "Removing: $path"
  rm -rf "$path"
done

echo "Done. Reload Cursor window."
