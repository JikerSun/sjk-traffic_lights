#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Installing AI Traffic Lights global hooks (all Cursor workspaces)..."
node tools/merge-user-hooks.mjs install

echo ""
echo "Next:"
echo "  1) Install extension: npm run install:cursor-extension:local  (or VSIX)"
echo "  2) Reload Cursor window"
echo "  3) Open any project folder — Status Lights follow Agent in that workspace"
echo ""
echo "If you previously ran per-project bootstrap, project hooks are auto-skipped when global is installed."
