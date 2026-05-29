#!/usr/bin/env bash
# Install AI Traffic Lights hooks into any Cursor project (bridge + state under .ai-traffic-lights/).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-.}"
TARGET="$(cd "$TARGET" && pwd)"

if [ ! -d "$TARGET" ]; then
  echo "Target directory does not exist: $TARGET" >&2
  exit 1
fi

echo "Installing AI Traffic Lights hooks into: $TARGET"

mkdir -p "$TARGET/.cursor/hooks" "$TARGET/scripts/lib" "$TARGET/.ai-traffic-lights"

cp "$ROOT_DIR/.cursor/hooks.json" "$TARGET/.cursor/hooks.json"
cp "$ROOT_DIR/.cursor/hooks/write-bridge-from-hook.mjs" "$TARGET/.cursor/hooks/write-bridge-from-hook.mjs"
cp "$ROOT_DIR/scripts/lib/"*.mjs "$TARGET/scripts/lib/"

if [ ! -f "$TARGET/.ai-traffic-lights/state.json" ]; then
  cat >"$TARGET/.ai-traffic-lights/state.json" <<'EOF'
{
  "tool": "cursor",
  "sessionId": "bootstrap",
  "state": "IDLE",
  "reason": "Initialized by bootstrap",
  "source": "bootstrap",
  "ts": 0
}
EOF
fi

echo "Done."
echo "  hooks:  $TARGET/.cursor/hooks.json"
echo "  bridge: $TARGET/.ai-traffic-lights/state.json"
echo ""
echo "Next:"
echo "  1) Install sidebar extension once (VSIX or: npm run install:cursor-extension:local from tool repo)"
echo "  2) Open this folder in Cursor: $TARGET"
echo "  3) Reload Window"
echo "  4) View: Open View... -> Status Lights"
