# Codex Onboarding Checklist

## Objective

Add Codex support with zero UI changes by implementing only a new adapter.

## Steps

1. Create `CodexAdapter` in `libs/adapters`.
2. Map Codex stream events to unified states.
3. Record event traces and replay against `TrafficLightEngine`.
4. Validate transitions with same acceptance criteria as Cursor.

## Expected mapping targets

- Turn/item started -> `RUNNING`
- Approval or user input required -> `WAITING_USER`
- Turn completed -> `DONE`
- Turn failed -> `ERROR`
