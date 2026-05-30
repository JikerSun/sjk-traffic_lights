import type { AiState, BridgeCounts, DisplayMode, LightRenderState, StateEvent } from "@traffic-lights/protocol";

export interface EngineConfig {
  blinkIntervalMs: number;
  badgeMaxDisplay: number;
}

export interface EngineSnapshot {
  state: AiState;
  latestEvent?: StateEvent;
  displayMode?: DisplayMode;
  counts?: BridgeCounts;
}

export const defaultEngineConfig: EngineConfig = {
  blinkIntervalMs: 700,
  badgeMaxDisplay: 9
};

export function resolveState(_current: AiState, incoming: AiState): AiState {
  return incoming;
}

export function reduceState(snapshot: EngineSnapshot, event: StateEvent): EngineSnapshot {
  return {
    ...snapshot,
    state: resolveState(snapshot.state, event.state),
    latestEvent: event
  };
}

export function formatBadgeCount(count: number, maxDisplay = defaultEngineConfig.badgeMaxDisplay): string {
  if (count <= 0) {
    return "";
  }
  if (count > maxDisplay) {
    return `${maxDisplay}+`;
  }
  return String(count);
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
      redBlinking: true,
      displayMode: "single"
    };
  }

  if (state === "WAITING_USER") {
    return {
      redOn: false,
      yellowOn: tick,
      greenOn: false,
      yellowBlinking: true,
      redBlinking: false,
      displayMode: "single"
    };
  }

  if (state === "WAITING_PLAN_BUILD") {
    return {
      redOn: tick,
      yellowOn: !tick,
      greenOn: false,
      yellowBlinking: false,
      redBlinking: false,
      displayMode: "single"
    };
  }

  return {
    redOn: state === "RUNNING",
    yellowOn: false,
    greenOn: state === "DONE",
    yellowBlinking: false,
    redBlinking: false,
    displayMode: "single"
  };
}

export function getMultiLightRenderState(
  counts: BridgeCounts,
  nowMs: number,
  config: EngineConfig = defaultEngineConfig
): LightRenderState {
  const tick = Math.floor(nowMs / config.blinkIntervalMs) % 2 === 0;
  const running = counts.running || 0;
  const waiting = counts.waiting || 0;
  const done = counts.done || 0;
  const error = counts.error || 0;
  const hasError = error > 0;
  const hasRunning = running > 0;

  return {
    redOn: hasError ? tick : hasRunning,
    redBlinking: hasError,
    redBadge: hasError
      ? formatBadgeCount(error, config.badgeMaxDisplay)
      : hasRunning
        ? formatBadgeCount(running, config.badgeMaxDisplay)
        : undefined,
    yellowOn: waiting > 0 ? tick : false,
    yellowBlinking: waiting > 0,
    yellowBadge: waiting > 0 ? formatBadgeCount(waiting, config.badgeMaxDisplay) : undefined,
    greenOn: done > 0,
    greenBadge: done > 0 ? formatBadgeCount(done, config.badgeMaxDisplay) : undefined,
    displayMode: "multi"
  };
}
