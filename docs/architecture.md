# Architecture

## Overview

The project uses a shared-core architecture:

- UI shells:
  - `products/cursor-extension`
  - `products/desktop-overlay`
- Shared logic:
  - `libs/protocol`: event and state type contracts
  - `libs/core`: state engine + render mapping + blink behavior
  - `libs/adapters`: tool-specific event translators

## Data Flow

1. Tool adapter emits normalized `StateEvent`.
2. `TrafficLightEngine` consumes events and resolves canonical state.
3. UI shell pulls `getRenderState()` and maps to image assets.
4. Yellow blinking is controlled by render-phase timing, not by adapter.

## Reuse Rule

All state decisions live in `libs/core`; UI layers only render.
