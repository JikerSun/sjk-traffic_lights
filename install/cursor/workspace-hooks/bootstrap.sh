#!/usr/bin/env bash
# Bootstrap hooks from this folder (install/cursor/workspace-hooks).
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-.}"
TARGET="$(cd "$TARGET" && pwd)"

if [ ! -d "$TARGET" ]; then
  echo "Target directory does not exist: $TARGET" >&2
  exit 1
fi

echo "Installing AI Traffic Lights hooks into: $TARGET"

mkdir -p "$TARGET/.cursor/hooks" "$TARGET/scripts/lib" "$TARGET/.ai-traffic-lights"

cp "$KIT_DIR/.cursor/hooks.json" "$TARGET/.cursor/hooks.json"
cp "$KIT_DIR/.cursor/hooks/write-bridge-from-hook.mjs" "$TARGET/.cursor/hooks/write-bridge-from-hook.mjs"
cp "$KIT_DIR/scripts/lib/"*.mjs "$TARGET/scripts/lib/"

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
echo "Next: install extension from install/cursor/extension/, open $TARGET in Cursor, Reload Window."
