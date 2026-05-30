# Codex sidebar extension

**Phase 2** — VS Code–compatible sidebar (for editors with Codex IDE extension).

- Reads `~/.codex/ai-traffic-lights/states/<workspace-id>/state.json`
- Same render logic as `products/cursor-extension` (shared `@traffic-lights/core`)
- Requires `npm run install:codex-hooks` (or desktop App Codex Hook install, Phase 3)

**Codex App users:** use [desktop overlay](../../desktop-overlay/README.md) instead — the App does not load third-party VSIX.

```bash
npm run build -w ai-traffic-lights-codex-extension
npm run package -w ai-traffic-lights-codex-extension
```
