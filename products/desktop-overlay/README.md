# Desktop Overlay (Tauri Track)

This app hosts the floating traffic-light window and later window-attach logic.

## Scope in current milestone

- Vite-based runnable overlay UI prototype (`npm run dev -w ai-traffic-lights-desktop-overlay`)
- Baseline coordinates and scaling behavior from project plan
- Yellow blink behavior identical to shared core rules
- Shared engine integration (`@traffic-lights/core`)
- Drag interaction preview (for later desktop persistence)

## Next milestone

- Integrate Tauri runtime shell wrapping this web UI
- Add macOS active-window tracking for Cursor attach
- Add draggable position persistence
