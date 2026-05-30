#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Installing Codex recon hooks (log only, no traffic lights yet)..."
TRAFFIC_LIGHTS_CODEX_RECON=1 node tools/merge-codex-hooks.mjs install --recon

echo ""
echo "1. Open Codex App → /hooks → Trust new hooks"
echo "2. Run a few Agent turns (include one approval if possible)"
echo "3. Send recon log: ~/.codex/ai-traffic-lights/recon/<date>/hook-events.jsonl"
