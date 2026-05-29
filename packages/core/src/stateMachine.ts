import type { AiState, LightRenderState, StateEvent } from "@traffic-lights/protocol";

export interface EngineConfig {
  blinkIntervalMs: number;
}

export interface EngineSnapshot {
  state: AiState;
  latestEvent?: StateEvent;
}

export const defaultEngineConfig: EngineConfig = {
  blinkIntervalMs: 700
};

export function resolveState(_current: AiState, incoming: AiState): AiState {
  return incoming;
}

export function reduceState(snapshot: EngineSnapshot, event: StateEvent): EngineSnapshot {
  return {
    state: resolveState(snapshot.state, event.state),
    latestEvent: event
  };
}

export function getLightRenderState(
  state: AiState,
  nowMs: number,
  config: EngineConfig = defaultEngineConfig
): LightRenderState {
  const tick = Math.floor(nowMs / config.blinkIntervalMs) % 2 === 0;

  if (state === "ERROR") {
    return {
      redOn: tick,
      yellowOn: false,
      greenOn: false,
      yellowBlinking: false,
      redBlinking: true
    };
  }

  if (state === "WAITING_USER") {
    return {
      redOn: false,
      yellowOn: tick,
      greenOn: false,
      yellowBlinking: true,
      redBlinking: false
    };
  }

  if (state === "WAITING_PLAN_BUILD") {
    return {
      redOn: tick,
      yellowOn: !tick,
      greenOn: false,
      yellowBlinking: false,
      redBlinking: false
    };
  }

  return {
    redOn: state === "RUNNING",
    yellowOn: false,
    greenOn: state === "DONE",
    yellowBlinking: false,
    redBlinking: false
  };
}
