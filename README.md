# AI Traffic Lights

Dual-track project for:

- Cursor extension sidebar status lights
- Desktop overlay status lights

Shared logic lives in workspace packages to avoid duplicate state handling.

## Current status

- Shared protocol/core/adapters scaffolded
- Cursor sidebar MVP scaffolded (manual state commands)
- Desktop overlay track scaffolded (Tauri-track placeholder)
- Asset and scaling spec documented

## Quick start

1. Install dependencies:
   - `npm install`
2. Build all packages:
   - `npm run build`
3. Run desktop overlay web shell:
   - `npm run dev -w ai-traffic-lights-desktop-overlay`

## Cursor bridge file

Cursor extension reads status events from:

- `.ai-traffic-lights/state.json`

Use command palette:

- `AI Traffic Lights: Open Bridge State File`

Then write event JSON in the unified format to drive the lights.

## Key docs

- `DEVELOPMENT_PLAN.md`
- `docs/architecture.md`
- `docs/adapter-spec.md`
- `docs/state-machine.md`
- `docs/codex-onboarding.md`
- `docs/debug-walkthrough.md`
- `docs/cursor-sidebar-quickstart.md`
