# Cursor Adapter Notes

## Current milestone

- Extension-side state bridge is wired:
  - bridge file: `.ai-traffic-lights/state.json`
  - extension watches file changes and updates shared engine
  - command: `AI Traffic Lights: Open Bridge State File`
- Manual state commands remain for local debug:
  - `aiTrafficLights.setRunning`
  - `aiTrafficLights.setWaiting`
  - `aiTrafficLights.setDone`
  - `aiTrafficLights.setIdle`

## Planned integration

Replace bridge/manual fallback with direct Cursor runtime event integration:

1. Consume Cursor runtime events
2. Translate to `StateEvent`
3. Emit into shared `TrafficLightEngine`

## Validation checklist

- Waiting state always blinks yellow
- Done state turns green and clears yellow
- Running state turns red and clears yellow
