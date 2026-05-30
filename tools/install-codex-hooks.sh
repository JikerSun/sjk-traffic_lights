#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Installing Codex bridge hooks..."
node tools/merge-codex-hooks.mjs install

echo ""
echo "Open Codex App → type /hooks → Review & Trust hooks for AI Traffic Lights."
echo "Bridge state: ~/.codex/ai-traffic-lights/states/<workspace-id>/state.json"
