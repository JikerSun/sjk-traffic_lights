#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Uninstalling AI Traffic Lights global hooks..."
node tools/merge-user-hooks.mjs uninstall

echo ""
echo "Also remove the Cursor extension (sidebar) if you no longer need it:"
echo "  Cursor → Extensions → AI Traffic Lights → Uninstall"
echo "  Or delete: ~/.cursor/extensions/local.ai-traffic-lights-cursor-extension-*"
echo ""
echo "Optional: remove per-project leftovers from bootstrapped repos:"
echo "  .cursor/hooks.json entries, .cursor/hooks/write-bridge-from-hook.mjs,"
echo "  scripts/lib/*.mjs, .ai-traffic-lights/"
