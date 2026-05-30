# Cursor Adapter Notes

## Current milestone

- Extension-side state bridge is wired (v0.1.6):
  - bridge file: `~/.cursor/ai-traffic-lights/states/<workspace-id>/state.json`
  - extension watches file changes and updates shared engine
  - **Multi Agent:** reads `displayMode` + `counts` when `bridgeVersion: 2`
  - command: `AI Traffic Lights: Open Bridge State File`
- Manual state commands remain for local debug:
  - `aiTrafficLights.setRunning` … `setError`

## Install (user path)

1. [Release v0.1.6 VSIX](../install/cursor/extension/README.md)
2. `npm run install:global-hooks` (from cloned repo)
3. Reload Window

## Uninstall extension

See [install/cursor/extension/README.md](../install/cursor/extension/README.md) §卸载扩展.

## Planned integration

Replace bridge/manual fallback with direct Cursor runtime event integration:

1. Consume Cursor runtime events
2. Translate to `StateEvent`
3. Emit into shared `TrafficLightEngine`

## Validation checklist

- Single agent: no badge digits; same as v0.1.5
- Multi agent: concurrent counts on lit lights
- Solo new agent after done wave: single mode, no stale green counts
- Waiting state always blinks yellow
- Done state turns green and clears yellow (single mode)
