import type { AiState, BridgeDocument, LightRenderState, StateEvent } from "@traffic-lights/protocol";
import {
  defaultEngineConfig,
  getLightRenderState,
  getMultiLightRenderState,
  reduceState,
  type EngineConfig,
  type EngineSnapshot
} from "./stateMachine.js";

type Listener = (snapshot: EngineSnapshot) => void;

export class TrafficLightEngine {
  private snapshot: EngineSnapshot = { state: "IDLE", displayMode: "single" };
  private readonly listeners = new Set<Listener>();
  private readonly trace: StateEvent[] = [];
  private readonly config: EngineConfig;

  constructor(config?: Partial<EngineConfig>) {
    this.config = { ...defaultEngineConfig, ...config };
  }

  consume(event: StateEvent): EngineSnapshot {
    this.snapshot = {
      ...reduceState(this.snapshot, event),
      displayMode: "single",
      counts: undefined
    };
    this.trace.push(event);
    if (this.trace.length > 100) {
      this.trace.shift();
    }
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
    this.snapshot = reduceState({ state: "IDLE" }, event);
    if (doc.displayMode === "multi" && doc.counts) {
      this.snapshot.displayMode = "multi";
      this.snapshot.counts = { ...doc.counts };
    } else {
      this.snapshot.displayMode = "single";
      this.snapshot.counts = undefined;
    }
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
    if (this.snapshot.displayMode === "multi" && this.snapshot.counts) {
      return getMultiLightRenderState(this.snapshot.counts, nowMs, this.config);
    }
    return getLightRenderState(this.snapshot.state, nowMs, this.config);
  }
}
