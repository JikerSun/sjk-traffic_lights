export type AiState =
  | "IDLE"
  | "RUNNING"
  | "WAITING_USER"
  | "WAITING_PLAN_BUILD"
  | "DONE"
  | "ERROR";

export type DisplayMode = "single" | "multi";

export interface StateEvent {
  tool: string;
  sessionId: string;
  state: AiState;
  reason?: string;
  source?: string;
  ts: number;
}

export interface BridgeCounts {
  running: number;
  waiting: number;
  done: number;
  error: number;
  plan: number;
}

export interface BridgeDocument extends StateEvent {
  workspaceRoot?: string;
  workspaceStateId?: string;
  bridgeVersion?: number;
  displayMode?: DisplayMode;
  counts?: BridgeCounts;
}

export interface LightRenderState {
  redOn: boolean;
  yellowOn: boolean;
  greenOn: boolean;
  yellowBlinking: boolean;
  redBlinking: boolean;
  displayMode?: DisplayMode;
  redBadge?: string;
  yellowBadge?: string;
  greenBadge?: string;
}

export interface EngineSnapshot {
  state: AiState;
  latestEvent?: StateEvent;
  displayMode?: DisplayMode;
  counts?: BridgeCounts;
}

interface EngineConfig {
  blinkIntervalMs: number;
  badgeMaxDisplay: number;
}

const DEFAULT_CONFIG: EngineConfig = {
  blinkIntervalMs: 700,
  badgeMaxDisplay: 9
};

function formatBadgeCount(count: number, maxDisplay: number): string {
  if (count <= 0) {
    return "";
  }
  if (count > maxDisplay) {
    return `${maxDisplay}+`;
  }
  return String(count);
}

function getLightRenderState(state: AiState, nowMs: number, config: EngineConfig): LightRenderState {
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

function getMultiLightRenderState(counts: BridgeCounts, nowMs: number, config: EngineConfig): LightRenderState {
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

type Listener = (snapshot: EngineSnapshot) => void;

export class TrafficLightEngine {
  private snapshot: EngineSnapshot = { state: "IDLE", displayMode: "single" };
  private readonly listeners = new Set<Listener>();
  private readonly config: EngineConfig;

  constructor(config?: Partial<EngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  consume(event: StateEvent): EngineSnapshot {
    this.snapshot = {
      state: event.state,
      latestEvent: event,
      displayMode: "single",
      counts: undefined
    };
    this.listeners.forEach((listener) => listener(this.snapshot));
    return this.snapshot;
  }

  consumeBridge(doc: BridgeDocument): EngineSnapshot {
    const event: StateEvent = {
      tool: doc.tool || "cursor",
      sessionId: doc.sessionId || "cursor-session",
      state: doc.state,
      reason: doc.reason,
      source: doc.source,
      ts: doc.ts || Date.now()
    };
    this.snapshot = {
      state: event.state,
      latestEvent: event,
      displayMode: doc.displayMode === "multi" && doc.counts ? "multi" : "single",
      counts: doc.displayMode === "multi" && doc.counts ? { ...doc.counts } : undefined
    };
    this.listeners.forEach((listener) => listener(this.snapshot));
    return this.snapshot;
  }

  setState(state: AiState, reason?: string): EngineSnapshot {
    return this.consume({
      tool: "manual",
      sessionId: "manual",
      state,
      reason,
      source: "manual",
      ts: Date.now()
    });
  }

  getSnapshot(): EngineSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  getRenderState(nowMs = Date.now()): LightRenderState {
    if (this.snapshot.displayMode === "multi" && this.snapshot.counts) {
      return getMultiLightRenderState(this.snapshot.counts, nowMs, this.config);
    }
    return getLightRenderState(this.snapshot.state, nowMs, this.config);
  }
}
