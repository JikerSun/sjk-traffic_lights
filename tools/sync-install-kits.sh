#!/usr/bin/env bash
# Refresh install/cursor/workspace-hooks from repo source (run after hook/lib changes).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KIT="$ROOT_DIR/install/cursor/workspace-hooks"

mkdir -p "$KIT/.cursor/hooks" "$KIT/scripts/lib"

cp "$ROOT_DIR/.cursor/hooks.json" "$KIT/.cursor/hooks.json"
cp "$ROOT_DIR/.cursor/hooks/write-bridge-from-hook.mjs" "$KIT/.cursor/hooks/write-bridge-from-hook.mjs"
cp "$ROOT_DIR/scripts/lib/"*.mjs "$KIT/scripts/lib/"
chmod +x "$KIT/bootstrap.sh"

echo "Synced workspace-hooks kit -> $KIT"
