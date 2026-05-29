# AI Traffic Lights - Development Plan

## 1) Project Goal

Build a reusable dual-delivery product in `sjk-traffic_lights`:

- Cursor plugin (sidebar-first UI)
- Desktop overlay app (window-attach + draggable)
- Shared core logic (state machine + adapters + protocol)

Traffic light behavior:

- Red: AI processing (solid on)
- Yellow: waiting for user input/confirmation (**blinking**)
- Green: response complete (solid on)

## 2) Current Confirmed Requirements

### 2.1 Product Behavior

- Support Cursor first.
- Keep architecture ready for Codex adapter later.
- Plugin and desktop app developed in parallel with maximum shared logic.
- Put all project files under `/Users/jakiesun/Desktop/sjk-traffic_lights`.

### 2.2 UI/Asset Constraints (Confirmed)

Assets directory: `image/`

- `panel_bg.png` => 112 x 299
- `light_red_on.png` => 90 x 90
- `light_red_off.png` => 90 x 90
- `light_yellow_on.png` => 90 x 90
- `light_yellow_off.png` => 90 x 90
- `light_green_on.png` => 90 x 90
- `light_green_off.png` => 90 x 90
- `app_icon_1024.png` => 1024 x 1024
- `extension_icon_128.png` => 128 x 128

### 2.3 Layout Rules (based on source-size assets)

- Red light: horizontally centered, top margin = 19 (inside panel)
- Yellow light: horizontally and vertically centered
- Green light: horizontally centered, bottom margin = 19 (inside panel)
- Allow proportional scaling while preserving relative layout.

### 2.4 Baseline Coordinates (Authoritative for Scaling)

Baseline canvas:

- Panel size: `Pw = 112`, `Ph = 299`
- Light size: `Lw = 90`, `Lh = 90`

Derived X (all lights share same horizontal center):

- `x = (Pw - Lw) / 2 = 11`

Y positions:

- Red top: `y_red = 19`
- Yellow centered: `y_yellow = (Ph - Lh) / 2 = 104.5`
- Green bottom margin 19: `y_green = Ph - 19 - Lh = 190`

Practical render rule:

- Keep internal math as float, round only at final render (`Math.round`) to avoid drift.
- For engines that require integer pixels, use nearest rounding and keep center alignment priority.

### 2.5 Proportional Scaling Formula

If scaled with factor `s` (uniform scale):

- `Pw' = Pw * s`, `Ph' = Ph * s`
- `Lw' = Lw * s`, `Lh' = Lh * s`
- `x' = x * s`
- `y_red' = y_red * s`
- `y_yellow' = y_yellow * s`
- `y_green' = y_green * s`

If target panel height/width is given instead of `s`:

- `s = min(targetWidth / Pw, targetHeight / Ph)` (preserve full panel without crop)

Constraints:

- Always keep uniform scale (same `s` on x/y); no non-uniform stretch.
- Preserve the three anchor semantics:
  - Red anchored by top margin ratio (`19 / 299`)
  - Yellow anchored by panel center
  - Green anchored by bottom margin ratio (`19 / 299`)

## 3) Technical Strategy

## 3.1 Monorepo Structure

Planned structure:

- `apps/cursor-extension` - Cursor extension UI shell
- `apps/desktop-overlay` - desktop floating/attach UI shell
- `packages/core` - state machine + priority + debounce + blink scheduler
- `packages/protocol` - shared event/type definitions
- `packages/adapters` - `CursorAdapter` first, later `CodexAdapter`
- `docs/` - architecture, adapter spec, state mapping, runbook

### 3.2 Reuse Boundary

Shared:

- state definitions
- status transition rules
- yellow blink logic
- adapter interface
- diagnostics/log format

Platform-specific:

- Cursor extension UI/container
- desktop window attach + drag persistence
- OS-level window detection APIs

## 4) State Model (Single Source of Truth)

Unified states:

- `RUNNING` -> red on
- `WAITING_USER` -> yellow blinking (on/off frames)
- `DONE` -> green on
- `ERROR` -> (phase 1: treat as red off + optional warning icon; exact UI in phase 2)
- `IDLE` -> (phase 1: green off, configurable later)

Priority rule:

- `WAITING_USER > RUNNING > DONE > IDLE`

Blink rule (initial default):

- `blinkIntervalMs = 700`
- 50% duty cycle (`yellow_on` <-> `yellow_off`)

## 5) Delivery Phases

## Phase 0 - Bootstrap + Docs

- Initialize monorepo and baseline tooling.
- Add architecture docs and adapter contract docs.
- Register asset usage spec and coordinate system.

Exit criteria:

- Repo structure created, install/build scripts available.

## Phase 1 - Shared Core

- Implement protocol types and state reducer.
- Implement yellow blink scheduler.
- Add event trace logging (for debugging adapter accuracy).

Exit criteria:

- Can feed mock events and observe correct red/yellow-blink/green output.

## Phase 2 - Cursor Plugin MVP (Sidebar First)

- Build sidebar traffic-light panel using provided assets.
- Consume core state stream.
- Add basic status text and source/reason debug line.

Exit criteria:

- Sidebar shows correct three-state behavior in Cursor flow.

## Phase 3 - Desktop Overlay MVP

- Floating always-on-top window.
- Draggable; persist location.
- Attach strategy v1: active Cursor window top-left anchoring.
- Fullscreen fallback positioning.

Exit criteria:

- Overlay follows Cursor window in common resize/move scenarios.

## Phase 4 - Hardening + GitHub Ready

- README, quick-start, screenshots/gifs.
- adapter onboarding doc for Codex.
- packaging scripts (desktop + extension artifact).

Exit criteria:

- Public repo can be cloned, built, and run by others.

## 6) Codex Future Onboarding (Reserved)

Implementation will follow documented adapter contract only:

1. Add `CodexAdapter` in `packages/adapters`.
2. Map Codex events -> unified states.
3. Validate accuracy using event logs/replay.
4. No UI changes required unless new state is introduced.

## 7) Risks and Mitigation

- Window attach edge cases (multiple Cursor windows, multi-monitor):
  - mitigation: active-window preference + manual lock target option (phase 2+)
- Incomplete external state signals:
  - mitigation: adapter confidence + trace logs + fallback heuristics
- Visual mismatch after scaling:
  - mitigation: keep source coordinate model and proportional transform only

## 8) Execution Log (Update Every Milestone)

### 2026-05-28

- Requirements clarified for dual-delivery architecture (plugin + desktop).
- Yellow state changed from solid to blinking.
- Final asset naming and dimensions verified under `image/`.
- This plan document created as the baseline for implementation tracking.
- Baseline coordinates and proportional scaling formulas were added.
- Monorepo scaffold started with shared `protocol/core/adapters` packages.
- Cursor extension sidebar MVP scaffold created with shared engine hookup.
- Docs added: architecture, state machine, adapter spec, Cursor notes, Codex onboarding checklist.
- Workspace dependencies installed and ordered build pipeline stabilized.
- Full build now passes for protocol/core/adapters/cursor-extension/desktop-overlay scaffold.
- Cursor extension now supports file-bridge state ingestion via `.ai-traffic-lights/state.json`.
- Desktop overlay upgraded to runnable Vite UI shell with shared engine + drag preview.
- Core tests added for state priority and yellow blink behavior; tests pass.
- Debug sequence tooling added (`debug:set:*`, `debug:next`, `debug:sequence`) for step-by-step visual QA.
- Added `docs/debug-walkthrough.md` to standardize "implement -> show lights -> verify -> continue" workflow.
- Added Cursor hooks-based automatic bridge writer (`.cursor/hooks.json`) to reduce manual `debug:next` usage.
- Switched to a hybrid runtime model:
  - hook script is primary state writer to bridge file
  - transcript watcher is fallback/reconciliation only
- Added detailed diagnostics for state debugging:
  - `.ai-traffic-lights/hook-events.log`
  - `.ai-traffic-lights/state-debug.json`
  - `.ai-traffic-lights/watcher-events.log`
  - watcher terminal trace (`[watcher:trace]`, `[watcher:write]`)
- Iterated watcher versions (`v2.1` -> `v2.7`) to reduce race conditions, multi-session conflicts, and startup false positives.
- Added running hint and ask-question latch heuristics to improve red/yellow timing.

### 2026-05-28 Night Debug Snapshot (Current Real State)

Observed with latest tests:

- Red state: mostly correct (AI starts -> red lights up).
- Green state: mostly correct (AI final response -> green).
- Yellow blinking state: still unstable in user-facing behavior (user reports still no reliable yellow flash at selection stage).

Known technical reality right now:

- When hook state is "fresh", watcher skips transcript scan (performance optimization).
- Therefore, yellow depends heavily on hook-side AskQuestion detection quality.
- Current hook mapping still misses some real waiting moments in user flow.
- Race remains possible between:
  - `afterAgentResponse` mapped as `DONE`
  - delayed/implicit AskQuestion signal in transcript

Unresolved user-facing issue (priority P0):

- Required flow is not fully stable yet:
  - AI running -> red
  - user selection/allow/confirm required -> yellow blinking
  - user responds -> red
  - AI final answer -> green

What was already changed for this issue:

- `afterAgentResponse` now also checks transcript for AskQuestion pending state.
- watcher fallback logic keeps evolving, but root symptom remains in some sessions.

Next root-cause target (for next session):

- Build a deterministic "pending AskQuestion" detector keyed by session/conversation id, not global aggregate counters.
- Ensure single-writer ordering semantics for each session:
  - RUNNING/WAITING_USER transitions cannot be overwritten by stale DONE from another event.
- Add compact timeline output per conversation id for exact event ordering.

Tomorrow start checklist (execute first thing):

1. Read this plan document first (sections 8/9/10).
2. Open latest logs:
   - `.ai-traffic-lights/hook-events.log`
   - `.ai-traffic-lights/state-debug.json`
   - `.ai-traffic-lights/watcher-events.log`
3. Reproduce with one clean conversation only (avoid cross-session noise).
4. Patch hook mapping to emit WAITING_USER deterministically for AskQuestion.
5. Keep watcher as safety fallback only; verify full state chain.
6. Re-run validation scenario and record final stable behavior in this file.

---

## 9) Known Limitations — WAITING_USER (Yellow) — Deferred Pending Cursor

**Status (2026-05-29, third acceptance test):** Red, green, `WAITING_PLAN_BUILD` (red/yellow alternate), and `ERROR` (red blink) behave correctly in real use. **Yellow blink during AskQuestion / Questions UI is not a current release requirement** until Cursor exposes a reliable signal.

### Observed user-facing behavior

| Stage | Expected | Actual (stable) |
|-------|----------|-----------------|
| Before Questions panel | Red | Red (OK) |
| Panel open, before Continue | Yellow blink | Often stays **red** |
| After Continue, before final answer | Red | Red (OK) |
| Turn complete | Green | Green (OK); v4.4 briefly flashed yellow-then-green at end — **fixed in v4.5** (removed post-`afterAgentResponse` silence heuristic) |

### Root cause (verified on Cursor ~3.5.x)

1. **`preToolUse` with matcher `AskQuestion` usually does not fire** in real Agent chats (only in manual/smoke runs).
2. **Transcript `tool_use: AskQuestion` rows often appear only after the user submits answers**, not when the panel opens — polling the `.jsonl` cannot detect “waiting now.”
3. **`stop(status=aborted)` sometimes correlates with AskQuestion** but is undocumented and not consistent enough to build product logic on alone.
4. There is **no documented hook** such as `waitingForUser` / `askQuestionShown` with stable semantics.

### What we tried (hooks + watcher + extension v4.2–v4.4)

- Hook matchers (`preToolUse` / `postToolUse` AskQuestion), `stop(aborted)` → `WAITING_USER`, `askPending` in `session-turn.json`, transcript phase `awaiting_selection`, extension supplement poll, embedded watcher, post-`afterAgentResponse` silence → yellow (reverted in v4.5 due to false yellow before green).

### Dependency on Cursor

Re-open yellow work when Cursor provides at least one of:

- Reliable **`preToolUse` / `postToolUse` for `AskQuestion`**, or
- A dedicated **waiting-for-user** hook with `conversation_id` / `generation_id`, or
- Transcript (or sidecar) updated **when the Questions UI opens**, not only after submit.

Feedback sent via **Help → Send Feedback** (Bug) describing the above.

### Engineering rule until then

- Do **not** add more aggressive heuristics (e.g. idle silence after `afterAgentResponse`) — they cause **yellow flash before green** at turn end without fixing panel-open yellow.
- Keep yellow-related code paths minimal; preserve red / green / plan / error behavior.

---

## 10) Next Immediate Steps

1. **Validate `WAITING_PLAN_BUILD`** (red ↔ yellow alternate after plan, until Build) in real Plan mode — user testing.
2. Freeze adapter contract after Plan validation; desktop/Tauri packaging when ready.
3. **Revisit yellow** only after Cursor API/transcript timing improves (see §9).
4. Keep Codex adapter deferred until Cursor state chain is acceptable for shipping.

## 11) Handoff Notes For Next Session

- **Canonical runtime doc:** [`docs/traffic-lights-runtime.md`](docs/traffic-lights-runtime.md) (logic, limits, performance v4.7).
- **Ship without reliable yellow / Plan-wait**; see §9 and runtime doc.
- **v4.7:** Slim `hooks.json` (no duplicate matchers, no thought/MCP hooks), extension only watches `state.json` (no watcher spawn, no 250ms poll), local `*.log` removed.
- Do not add yellow/plan heuristics without new Cursor signals.
- **Next product work:** desktop overlay test first, then Codex adapter (see runtime doc).

### 2026-05-29 v4.7 — performance & docs cleanup

- Removed high-frequency hooks (`afterAgentThought`, MCP before/after) and duplicate matcher entries (halves subprocess invocations per tool).
- Hook reads transcript only on events that need it.
- Extension: removed embedded watcher + supplement poll; bridge file watcher only.
- Deleted `.ai-traffic-lights/*.log` and obsolete debug JSON; `.gitignore` updated.

### 2026-05-29 Plan mode acceptance (user test)

| Phase | Expected | User observed |
|-------|----------|---------------|
| A — generating plan | `RUNNING`, red solid | **OK** — RUNNING + red |
| B — plan shown, before Build | `WAITING_PLAN_BUILD`, red ↔ yellow | **Mismatch** — user reported **green** (not red/yellow alternate) |
| C — after Build, in progress | `RUNNING`, red solid | **OK** — RUNNING + red |
| D — turn complete | `DONE`, green solid | **OK** — DONE + green |

Bridge snapshot during session: `session-turn.json` had `plan.awaitingBuild: false`, `plan.touched: false` — hooks did not latch Plan-waiting for this run.

Automated smoke: `npm run debug:set:plan` writes `WAITING_PLAN_BUILD` to `state.json` correctly (UI path works if extension reads bridge).

**Next:** If user wants real Plan flow fixed, say **「修 Plan 灯」** before code changes (likely: detect Plan panel / `CreatePlan` / `.plan.md` / `stop` + `~/.cursor/plans` scan).

### 2026-05-29 Plan round-2 retest (`plan_灯效复测流程_e1030d6a`)

| Phase | Expected | User observed |
|-------|----------|---------------|
| A | RUNNING, red | **OK** |
| B | WAITING_PLAN_BUILD, red/yellow | **Mismatch** — RUNNING, red only |
| C | RUNNING, red | **OK** |
| D | DONE, green (no false flash) | Pending user check after reply |

Build step executed: `.ai-traffic-lights/plan-test-marker.txt` written. `session-turn.plan` still `awaitingBuild: false` during run — Plan-wait hooks not latched in this session.

### 2026-05-29 v4.6 — false WAITING_PLAN_BUILD after turn complete

- **Symptom:** Reply finished, lights switched to **red/yellow alternate** instead of green.
- **Cause:** On `stop(completed)`, hook scanned `~/.cursor/plans/*.plan.md` (including acceptance plan files) and/or `agentTextImpliesPlanAwaitingBuild` on summary text → `plan.awaitingBuild` → `WAITING_PLAN_BUILD` over `DONE`.
- **Fix:** `stop(completed)` always maps `DONE` and clears plan context; plan filesystem scan only on `stop(aborted)`; tightened acceptance-doc text exclusion in plan heuristic.

### 2026-05-29 v4.5 — remove false yellow before green

- **Symptom:** After a normal turn completed, lights briefly **yellow then green**.
- **Cause:** v4.4 `shouldInferPauseWaiting()` treated silence after `afterAgentResponse` as AskQuestion wait; extension/watcher wrote `WAITING_USER` ~600ms before `stop(completed)` → `DONE`.
- **Fix:** Removed pause-silence heuristic; extension supplement no longer promotes yellow when bridge is already `DONE`/`IDLE`/`ERROR`.

### 2026-05-29 Phase 0 Evidence (Single Conversation)

Test transcript: `05e97baf-476e-4405-b2c7-19b8a2001c8e.jsonl`

| Row | Role | Expected state |
|-----|------|----------------|
| user "再让我试试" | user | RUNNING |
| assistant AskQuestion only | assistant | **WAITING_USER** |
| assistant "这次你选择的是..." | assistant | DONE (resolved without user row) |

Root cause of missing yellow:

- Old logic treated "latest assistant has AskQuestion" only, or `afterAgentResponse` -> DONE before transcript had AskQuestion row.
- AskQuestion is often followed by assistant resolution text **without** a user row; old code did not model "pending until resolved".

Hook event log (2026-05-29) showed many `preToolUse`/`postToolUse` as RUNNING, `afterAgentResponse`+`stop` as DONE — no WAITING_USER when AskQuestion was not in `preToolUse` tool name.

### 2026-05-29 Phase 1 Implementation (v3.0)

New shared module: `scripts/lib/cursor-transcript-state.mjs`

- `resolveStateFromTranscriptRows()` — pending AskQuestion until user row or assistant resolution text after it.
- `mapHookEventToState()` — hook events + transcript authority on `stop` / `afterAgentResponse`.

Hook writer (`.cursor/hooks/write-bridge-from-hook.mjs`):

- Writes `.ai-traffic-lights/active-session.json` (single active conversation + transcript path).
- `stop` / `afterAgentResponse` use transcript resolver (not blind DONE).

Watcher (`scripts/cursor-state-watcher.mjs` v3.0):

- Reads **only** `active-session.json` transcript (single-session mode).
- Reconciles bridge when inferred state differs (removed "hook fresh => skip all scanning" behavior).

Automated verification (agent-run):

```bash
node scripts/verify-transcript-state.mjs <transcript.jsonl>
# row 97 -> WAITING_USER, row 98 -> DONE

# Simulated hook stop with transcript ending at AskQuestion:
# state.json -> WAITING_USER, source cursor-hook:stop+transcript
```

### 2026-05-29 v3.1 — false green / red-green flicker

**Symptom:** Green or red/green alternation while agent is still writing code or thinking.

**Cause:**

- Transcript resolver treated "latest row = assistant text" as `DONE`.
- `afterAgentResponse` hook mapped to transcript state → often `DONE` mid-turn.
- Watcher could overwrite `RUNNING` with inferred `DONE`, then `preToolUse` set `RUNNING` again.

**Fix:**

- Transcript never infers `DONE` (assistant text mid-turn = `RUNNING`).
- `afterAgentResponse` → always `RUNNING` unless transcript has pending AskQuestion → `WAITING_USER`.
- Only `stop` with `status=completed` (and not pending AskQuestion) → `DONE`.
- Watcher never writes `DONE`; never clears `DONE` → `RUNNING` (new turn: hook `beforeSubmitPrompt`).

### 2026-05-29 v3.7 — yellow only on awaiting_selection

- Clear latch + force **RUNNING** on `beforeSubmitPrompt` (fixes yellow flash when sending new message).
- Watcher yellow **only** when `phase=awaiting_selection` (not `agent_replying` + latch).
- No yellow on late-detected `newAsk` after answer row already in transcript.

### 2026-05-29 v3.6 — hook stops clobbering yellow + fast poll

- Hook **no longer writes** `RUNNING` on `preToolUse` / `postToolUse` / `afterAgentResponse` (log only).
- `phase=awaiting_selection` → watcher always holds `WAITING_USER` until a follow-up row appears.
- `session-turn.json` + **100ms fast poll** while agent turn active (catch AskQuestion row before answer row).
- Longer latch (8s) when question detected with only AskQuestion row in transcript.

### 2026-05-29 v3.5 — hook/watcher fight fix

- **Root cause:** `postToolUse` wrote `RUNNING` over watcher `WAITING_USER` (user saw red during question); `stop` kept yellow when latch active (no green).
- Hook: `shouldPreserveWaitingUser()` — tools do not downgrade yellow while `awaiting_selection`; `stop(completed)` → `DONE` and clears latch.
- Watcher: no false yellow on `startup` (seed `lastAskIdx` only).

### 2026-05-29 v3.4 — new AskQuestion row + min yellow hold

**Evidence:** `watcher-events.log` never contained `awaiting_selection`; every burst read already had AskQuestion row + follow-up assistant row (e.g. rows 556+557), so phase was always `agent_replying`.

**Fix:** Track `lastAskIdx` in `watcher-cursor.json`. When it increases → write `WAITING_USER` + `ask-latch.json` `minHoldUntil` (1200ms) even if follow-up row exists. Hook respects hold (won't `stop`→`DONE` during hold).

### 2026-05-29 v3.3 — AskQuestion phase + yellow latch

**Root cause (ABC test rows 542–543):** AskQuestion row and “你选了 A” assistant row land in transcript together before hooks run; old logic treated any following assistant text as “answered” and skipped yellow; `stop` went straight to green.

**Fix:**

- `getAskQuestionPhase()`: `awaiting_selection` (only AskQuestion row) → yellow; `agent_replying` (follow-up assistant after pick) → red; then green on `stop`.
- Removed “any user/assistant row after AskQuestion = resolved” heuristic.
- `ask-latch.json` while awaiting selection; hook `stop`/`afterAgentResponse` respect latch.
- Watcher v3.3: burst reads at 0/25/80/200ms on transcript `fs.watch`; logs to `.ai-traffic-lights/watcher-events.log`.

### 2026-05-29 v3.2 — transcript fs.watch (faster yellow)

- Watcher `fs.watch` on `active-session.json` → re-bind when conversation/transcript path changes.
- `fs.watch` on active transcript `.jsonl` → debounced recompute (~60ms), not only 800ms poll.
- Poll remains fallback + re-bind if transcript file appears later.
- Flag: `node scripts/cursor-state-watcher.mjs 800 --no-watch` to disable watch (debug).

### User validation (required in Cursor UI)

1. `Reload Window` once (hooks + extension).
2. Terminal: `npm run bridge:watch` (v3.4). Expect `new AskQuestion row=... -> yellow hold` in terminal.
3. Single Agent chat: ask for a choice (a/b/c), select, wait for answer.
4. Expected: red -> yellow blink at choice -> red after continue -> green at end.
5. If wrong: `npm run debug:hook:inspect 20` and paste output.

Screenshot / pixel detection: **not in scope** (confirmed 2026-05-29).
