export type AiState =
  | "IDLE"
  | "RUNNING"
  | "WAITING_USER"
  | "WAITING_PLAN_BUILD"
  | "DONE"
  | "ERROR";

export interface StateEvent {
  tool: string;
  sessionId: string;
  state: AiState;
  reason?: string;
  source?: string;
  ts: number;
}

export interface LightRenderState {
  redOn: boolean;
  yellowOn: boolean;
  greenOn: boolean;
  yellowBlinking: boolean;
  redBlinking: boolean;
}

export interface EngineSnapshot {
  state: AiState;
  latestEvent?: StateEvent;
}

interface EngineConfig {
  blinkIntervalMs: number;
}

const DEFAULT_CONFIG: EngineConfig = {
  blinkIntervalMs: 700
};

function getLightRenderState(state: AiState, nowMs: number, config: EngineConfig): LightRenderState {
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

type Listener = (snapshot: EngineSnapshot) => void;

export class TrafficLightEngine {
  private snapshot: EngineSnapshot = { state: "IDLE" };
  private readonly listeners = new Set<Listener>();
  private readonly config: EngineConfig;

  constructor(config?: Partial<EngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  consume(event: StateEvent): EngineSnapshot {
    this.snapshot = { state: event.state, latestEvent: event };
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
    return getLightRenderState(this.snapshot.state, nowMs, this.config);
  }
}
