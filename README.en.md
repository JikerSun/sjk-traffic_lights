# AI Traffic Lights

**Language / 语言：** [简体中文](README.md) · **English** (this page)

Show **red / yellow / green** traffic lights for Cursor Agent status in the sidebar or as a desktop overlay. Supports **single-agent** and **multi-agent parallel** counting (extension **v0.1.6** · desktop **v0.1.2**).

**Repository:** https://github.com/JikerSun/sjk-traffic_lights  
**Current stable releases:**

| Product | Version | Download |
|---------|---------|----------|
| Cursor sidebar extension | **v0.1.6** | [Release](https://github.com/JikerSun/sjk-traffic_lights/releases/tag/v0.1.6) · `ai-traffic-lights-cursor.vsix` |
| Mac desktop overlay app | **v0.1.2** | [Release](https://github.com/JikerSun/sjk-traffic_lights/releases/tag/desktop-v0.1.2) · `AI Traffic Lights_0.1.2_aarch64.dmg` |

### Project status (2026-05-30)

| Phase | Status |
|-------|--------|
| Cursor single / multi-agent monitoring (Hook + bridge) | ✅ **Paused for now** (Single regression + Multi counting verified) |
| Cursor sidebar extension (Mac) | ✅ **v0.1.6** shipped |
| Cursor sidebar extension (Windows) | 🧪 Pending colleague smoke test |
| Mac desktop overlay app | ✅ **v0.1.2** shipped · [install guide](install/desktop/README.md) |
| Windows desktop app | 🔴 Needs Windows build; window API not implemented |
| Yellow light / Plan mode | ⏸ Blocked by Cursor hook signals |
| Mobile sync / Codex | 📋 Later · see [docs/HANDOFF.md](docs/HANDOFF.md) |

---

## How it works (two layers — both needed for automatic lights)

| Layer | Install once per machine | Role | Location |
|-------|--------------------------|------|----------|
| **A. Cursor extension** | Yes | Sidebar **Status Lights** (reads state, renders UI) | VSIX → `~/.cursor/extensions/` |
| **B. Global Hooks** | Yes | Writes state when Agent runs | `~/.cursor/hooks.json` + `~/.cursor/ai-traffic-lights/` |

```
Cursor Agent events
  → ~/.cursor/hooks.json calls write-bridge-from-hook.mjs
  → ~/.cursor/ai-traffic-lights/states/<workspace-id>/state.json
  → extension or desktop app fs.watch → UI updates
```

- **Extension only, no Hooks** → sidebar appears, lights **do not** follow Agent automatically (manual test commands still work).
- **Hooks only, no extension** → state file updates, **no** sidebar UI (use the desktop overlay app instead).
- **Each project folder** gets its own `state.json` (path hash), so multiple projects **do not** cross-contaminate.
- **Multiple parallel agents** → Multi mode (lights can co-lit with counts); a single managed agent → same Single-mode behavior as before.

Hooks require **Node.js ≥ 20** (install/uninstall only; Cursor does not keep Node running). The **desktop app auto-installs Hooks on first launch** — you usually do not need `install:global-hooks` manually.

---

## Installation (recommended: Release VSIX + global Hooks)

### Step 1: Install the sidebar extension (VSIX)

1. Open **[Releases](https://github.com/JikerSun/sjk-traffic_lights/releases)** and download **`ai-traffic-lights-cursor.vsix`** (**v0.1.6**)
2. **Reinstalling?** Quit Cursor completely (`Cmd+Q`) before installing (avoids `Please restart VS Code before reinstalling`)
3. Cursor → Command Palette (Mac `Cmd+Shift+P` / Windows `Ctrl+Shift+P`) → **Extensions: Install from VSIX...** → select the file  
   Or with Cursor closed: `"/Applications/Cursor.app/Contents/Resources/app/bin/cursor" --install-extension /path/to.vsix`
4. **Reload Window**

### Step 2: Install global Hooks

**Clone this repo once** (Hook install scripts live in the repo; the VSIX does not bundle them).

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights
npm install
npm run install:global-hooks
```

The script will:

- Copy Hook scripts to `~/.cursor/ai-traffic-lights/hooks/` and `lib/`
- **Merge** into `~/.cursor/hooks.json` (appends only our entries if you already have other Hooks; backs up first as `hooks.json.bak.ai-traffic-lights.<timestamp>`)
- Write `~/.cursor/ai-traffic-lights/install-manifest.json` (for uninstall)

**Does not** modify your project source; state lives under your user directory.

> **Desktop app only?** Skip this step — the app auto-installs equivalent Hooks on first launch. See **Desktop overlay app** below.

### Step 3: Enable

1. Cursor → **Reload Window**
2. Open **any project root folder** in Cursor (not a subfolder only)
3. Open **Status Lights** (Command Palette: `AI Traffic Lights: Show Status Lights`)
4. Run an Agent → expect **red (running) → green (done)**; parallel agents show per-light counts

**State file example:**

- macOS / Linux: `~/.cursor/ai-traffic-lights/states/<workspace-id>/state.json`
- Windows: `%USERPROFILE%\.cursor\ai-traffic-lights\states\<workspace-id>\state.json`

Self-check: after an Agent run, `state` should change among `RUNNING` / `DONE` / etc., and `workspaceRoot` must be **your project path** (not the `.cursor` user folder). Multi mode adds `displayMode`, `counts`, etc.

---

## Uninstall (complete)

Extension and Hooks are **separate**. Remove both for a clean uninstall, then **Reload Window**.

### Option A: You cloned the repo (recommended)

From the `sjk-traffic_lights` directory:

```bash
# 1. Remove global Hooks + bridge data
npm run uninstall:global-hooks

# 2. Remove extension (~/.cursor/extensions/local.ai-traffic-lights-cursor-extension-*)
npm run uninstall:cursor-extension
```

`uninstall:global-hooks` will:

- Delete all of `~/.cursor/ai-traffic-lights/` (including per-workspace `states/`)
- **Remove** our commands from `~/.cursor/hooks.json` (keeps your other Hooks)
- Delete `hooks.json` if nothing remains

Then **Reload Window**.

### Option B: VSIX only, never cloned the repo

| What to remove | How |
|----------------|-----|
| **Extension (VSIX)** | Cursor → **Extensions** → **AI Traffic Lights** → **Uninstall** → Reload; or with Cursor closed: `cursor --uninstall-extension local.ai-traffic-lights-cursor-extension` (Mac full path: [install/cursor/extension/README.md](install/cursor/extension/README.md)) |
| **Global Hooks** | **Clone the repo**, then `npm install && npm run uninstall:global-hooks` (same as Option A step 1) |

Extension only, Hooks left behind: no sidebar UI, but Hooks may still write files (minimal impact). Remove Hooks for a full cleanup.

### Optional: per-project bootstrap leftovers

In each project where you ran bootstrap, manually delete if present:

- Our commands in `.cursor/hooks.json`
- `.cursor/hooks/write-bridge-from-hook.mjs`
- Bridge-related `.mjs` under `scripts/lib/`
- `.ai-traffic-lights/` (runtime dir)

With global Hooks installed, project-level copies auto-skip, but removing leftovers avoids confusion.

**Note:** No background daemon; uninstall frees CPU/memory. Orphan `state.json` files are small disk artifacts, not memory leaks.

---

## Post-install checklist

- [ ] **AI Traffic Lights** appears under Extensions, or commands show in the palette
- [ ] Ran `npm run install:global-hooks` (or desktop app auto-installed), and `~/.cursor/ai-traffic-lights/install-manifest.json` exists
- [ ] `~/.cursor/hooks.json` contains `ai-traffic-lights` / `write-bridge-from-hook.mjs`
- [ ] Current window opened at **project root**
- [ ] **Reload Window** done
- [ ] After an Agent run, `states/.../state.json` `state` changes

**Manual light test (no Agent):** `Cmd+Shift+P` → `AI Traffic Lights: Set Running` / `Set Done`

**Still stuck?** Output panel → **Hooks** for errors; verify `workspaceRoot` in `state.json`.

---

## Desktop overlay app (Mac · standalone product)

Works **without VSIX**: always-on-top three-light overlay; **auto-installs global Hooks on first launch** — no repo clone required.

### Download & install (Mac)

1. Open **[GitHub Releases](https://github.com/JikerSun/sjk-traffic_lights/releases)**, download **`AI Traffic Lights_0.1.2_aarch64.dmg`** under tag **`desktop-v0.1.2`** (Apple Silicon)
2. Open dmg → drag **AI Traffic Lights** to **Applications**
3. Clear quarantine: `xattr -cr "/Applications/AI Traffic Lights.app"`
4. Launch (if blocked: **System Settings → Privacy & Security → Open Anyway**)
5. **Setup** wizard: pick IDE + Cursor window → **Continue**
6. Requires **Node.js ≥ 20** (Hook install/uninstall; app probes Homebrew and common paths)

Full steps, uninstall, local build: [install/desktop/README.md](install/desktop/README.md)  
Features & known issues: [docs/desktop-app-status.md](docs/desktop-app-status.md)

> **Maintainers:** after `npm run build:desktop`, `gh release create desktop-v0.1.2 --attach dmg` — see install/desktop §B.

### Windows `.exe`

**Cannot cross-compile exe on Mac.** On Windows 10/11, clone and `npm run build:desktop`; output under  
`products/desktop-overlay/src-tauri/target/release/bundle/nsis/*-setup.exe`.  
Details: [install/desktop/README.md](install/desktop/README.md) §C.

---

## Other install paths

| Method | Notes |
|--------|-------|
| [Releases VSIX](https://github.com/JikerSun/sjk-traffic_lights/releases) + `install:global-hooks` | **Recommended for colleagues (sidebar)** |
| [Releases desktop dmg](https://github.com/JikerSun/sjk-traffic_lights/releases) | **Desktop overlay (Mac)** |
| `npm run install:cursor-extension:local` | Dev install from source (not VSIX) |
| `npm run package:extension` | Build VSIX locally → `install/cursor/extension/` |
| `install/cursor/workspace-hooks/bootstrap.sh <project>` | **Fallback**: per-project Hooks only; not recommended daily |

Install tree: [install/](install/) · Handoff for devs: [docs/HANDOFF.md](docs/HANDOFF.md) · Multi-agent design: [docs/multi-agent-design.md](docs/multi-agent-design.md)

---

## Features & limits

| Capability | Status |
|------------|--------|
| Red `RUNNING` / green `DONE` / flashing red `ERROR` | ✅ Stable |
| Single agent (Single mode) | ✅ Same as v0.1.5 behavior |
| Parallel multi-agent (Multi counts) | ✅ v0.1.6 / desktop v0.1.2 |
| Yellow `WAITING_USER` (AskQuestion) | ⚠️ Cursor signals insufficient; often stays red |
| Plan red/yellow flash `WAITING_PLAN_BUILD` | ⚠️ Plan Hook hard to latch; often stays red |
| Multi-project isolation | ✅ Per-workspace `state.json` |

Details: [docs/traffic-lights-runtime.md](docs/traffic-lights-runtime.md)

---

## Performance & security

- Hooks spawn a **Node child process** only on Agent events; **zero overhead** when idle.
- Extension / desktop app **watch one** `state.json` per workspace — no polling.
- State files only under `~/.cursor/ai-traffic-lights/states/`, partitioned by workspace hash.

---

## Developers

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights && npm install && npm run build
npm run install:global-hooks
npm run install:cursor-extension:local   # or npm run package:extension
```

| Command | Purpose |
|---------|---------|
| `npm run install:global-hooks` | Install user-level Hooks |
| `npm run uninstall:global-hooks` | Remove Hooks + `~/.cursor/ai-traffic-lights/` |
| `npm run uninstall:cursor-extension` | Remove local extension dir |
| `npm run package:extension` | Build VSIX (upload to Release; not committed) |
| `npm run build:desktop` | Build Mac `.dmg` / Windows `.exe` (Windows build on Windows) |
| `npm run debug:multi:inspect` | Inspect Multi Agent bridge state (debug) |

---

## Documentation index

| Doc | Content |
|-----|---------|
| [README.md](README.md) | Chinese readme (counterpart to this file) |
| [docs/HANDOFF.md](docs/HANDOFF.md) | **Start here for iteration**: status, architecture, next tasks |
| [docs/multi-agent-design.md](docs/multi-agent-design.md) | Multi-agent spec (implemented) |
| [docs/desktop-app-status.md](docs/desktop-app-status.md) | Desktop app features & known issues |
| [install/desktop/README.md](install/desktop/README.md) | Mac dmg install / Windows exe build |
| [docs/distribution.md](docs/distribution.md) | Complementary distribution notes |
| [docs/traffic-lights-runtime.md](docs/traffic-lights-runtime.md) | Runtime logic & version notes |

---

## License & contributions

VSIX / dmg ship via **Releases**, not git (see `.gitignore`). Do not commit per-project `.ai-traffic-lights/` runtime files.
