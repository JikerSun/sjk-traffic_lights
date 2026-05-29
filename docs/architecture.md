# Architecture

## Overview

The project uses a shared-core architecture:

- UI shells:
  - `apps/cursor-extension`
  - `apps/desktop-overlay`
- Shared logic:
  - `packages/protocol`: event and state type contracts
  - `packages/core`: state engine + render mapping + blink behavior
  - `packages/adapters`: tool-specific event translators

## Data Flow

1. Tool adapter emits normalized `StateEvent`.
2. `TrafficLightEngine` consumes events and resolves canonical state.
3. UI shell pulls `getRenderState()` and maps to image assets.
4. Yellow blinking is controlled by render-phase timing, not by adapter.

## Reuse Rule

All state decisions live in `packages/core`; UI layers only render.
