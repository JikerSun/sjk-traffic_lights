#!/usr/bin/env bash
# Copy hook scripts into Tauri app resources (desktop App install kit).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KIT="${ROOT_DIR}/products/desktop-overlay/src-tauri/resources/hook-kit"

rm -rf "$KIT"
mkdir -p "$KIT/scripts/lib" "$KIT/hooks"

cp -R "${ROOT_DIR}/scripts/lib/." "$KIT/scripts/lib/"
cp "${ROOT_DIR}/.cursor/hooks/write-bridge-from-hook.mjs" "$KIT/hooks/"
cp "${ROOT_DIR}/tools/merge-user-hooks.mjs" "$KIT/"

echo "Synced hook kit -> $KIT"
