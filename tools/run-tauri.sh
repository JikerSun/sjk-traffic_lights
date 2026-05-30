#!/usr/bin/env bash
# Ensure rustup/cargo is on PATH (Tauri needs `cargo metadata`).
set -euo pipefail

if ! command -v cargo >/dev/null 2>&1; then
  if [ -f "${HOME}/.cargo/env" ]; then
    # shellcheck disable=SC1091
    source "${HOME}/.cargo/env"
  fi
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "Error: cargo not found. Install Rust first:"
  echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"
  echo "  source \"\$HOME/.cargo/env\""
  exit 1
fi

# Stale Vite from a previous `tauri dev` can block port 1420.
if [[ "${1:-}" == "dev" ]] && command -v lsof >/dev/null 2>&1; then
  stale_pids="$(lsof -ti :1420 2>/dev/null || true)"
  if [[ -n "${stale_pids}" ]]; then
    echo "Port 1420 in use; stopping stale dev server..."
    kill -9 ${stale_pids} 2>/dev/null || true
    sleep 0.3
  fi
fi

exec npx tauri "$@"
