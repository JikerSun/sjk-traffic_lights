# State Machine

## Transition Rule

The newest event wins. State advances with each incoming normalized event:

- `RUNNING` -> processing
- `WAITING_USER` -> awaiting confirmation/input
- `DONE` -> finished response
- `IDLE` -> idle
- `ERROR` -> failure state

## Render Mapping

- `RUNNING` -> red on
- `WAITING_USER` -> yellow blinking (`on/off` every 700ms)
- `DONE` -> green on
- `IDLE`, `ERROR` -> all off (phase 1)

## Blink

- Interval: `700ms`
- Duty cycle: `50%`
- Compute in render layer via `Math.floor(now / interval) % 2`
