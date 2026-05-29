import type { AiState, LightRenderState, StateEvent } from "@traffic-lights/protocol";
import { defaultEngineConfig, getLightRenderState, reduceState, type EngineConfig, type EngineSnapshot } from "./stateMachine.js";

type Listener = (snapshot: EngineSnapshot) => void;

export class TrafficLightEngine {
  private snapshot: EngineSnapshot = { state: "IDLE" };
  private readonly listeners = new Set<Listener>();
  private readonly trace: StateEvent[] = [];
  private readonly config: EngineConfig;

  constructor(config?: Partial<EngineConfig>) {
    this.config = { ...defaultEngineConfig, ...config };
  }

  consume(event: StateEvent): EngineSnapshot {
    this.snapshot = reduceState(this.snapshot, event);
    this.trace.push(event);
    if (this.trace.length > 100) {
      this.trace.shift();
    }
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

  getTrace(): StateEvent[] {
    return [...this.trace];
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
