# Cursor Sidebar Quickstart

This is the fastest path to see lights inside Cursor sidebar.

## 1) Build and install extension locally

From project root:

```bash
npm run install:cursor-extension:local
```
Then reload Cursor window.

## 2) Open sidebar view

In your normal Cursor window:

- Command palette -> `View: Open View...` -> search `Status Lights`

## 3) Drive states step-by-step

Return to project root terminal:

```bash
npm run debug:reset
npm run debug:next
npm run debug:next
npm run debug:next
npm run debug:next
```

Expected sequence:

1. red on
2. yellow blinking
3. red on
4. green on

## 4) One-command auto demo

```bash
npm run debug:sequence
```

The bridge file source is `.ai-traffic-lights/state.json`.
