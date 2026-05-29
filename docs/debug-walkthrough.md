# Debug Walkthrough (Step-by-step Visual Check)

Use this flow to validate each milestone visually before continuing development.

## 1) Open UI

1. Open Cursor with this workspace.
2. Open the sidebar view `Status Lights`.
3. (Optional) Run desktop shell:
   - `npm run dev -w ai-traffic-lights-desktop-overlay`

## 2) Run single-step checks

From project root:

- Red: `npm run debug:set:running`
- Yellow blinking: `npm run debug:set:waiting`
- Green: `npm run debug:set:done`
- Idle/off baseline: `npm run debug:set:idle`

Expected:

- `RUNNING` -> red on only
- `WAITING_USER` -> yellow blinking only
- `DONE` -> green on only
- `IDLE` -> all off (phase 1 behavior)

## 3) Walk through full sequence

- Reset: `npm run debug:reset`
- Next step: `npm run debug:next` (run repeatedly to verify transitions)
- Auto demo: `npm run debug:sequence`

Sequence:

1. RUNNING
2. WAITING_USER (blink)
3. DONE

## 4) Bridge file reference

Script writes to:

- `.ai-traffic-lights/state.json`

The Cursor extension watches this file and updates lights automatically.

## 5) Automatic mode (no `debug:next`)

Automatic bridge writing is now enabled via Cursor hooks:

- `.cursor/hooks.json`
- `.cursor/hooks/write-bridge-from-hook.mjs`

Mapped behavior:

- `beforeSubmitPrompt` / `preToolUse` -> `RUNNING` (red)
- `afterAgentResponse` -> `DONE` (green)
- `stop` with `aborted` -> `WAITING_USER` (yellow blink)

After editing hooks, run `Reload Window` in Cursor once.
