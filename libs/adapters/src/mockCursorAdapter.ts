import type { StateEvent } from "@traffic-lights/protocol";
import type { ToolAdapter } from "./index.js";

type EventCallback = (event: StateEvent) => void;

export class MockCursorAdapter implements ToolAdapter {
  readonly name = "cursor";
  private callbacks = new Set<EventCallback>();
  private timer?: NodeJS.Timeout;
  private idx = 0;

  private readonly sequence: Array<Pick<StateEvent, "state" | "reason" | "source">> = [
    { state: "RUNNING", reason: "AI is reasoning", source: "mock" },
    { state: "WAITING_USER", reason: "Awaiting approval", source: "mock" },
    { state: "RUNNING", reason: "Resumed execution", source: "mock" },
    { state: "DONE", reason: "Answer completed", source: "mock" },
    { state: "IDLE", reason: "Session idle", source: "mock" }
  ];

  async start(): Promise<void> {
    this.stopTimer();
    this.timer = setInterval(() => {
      const current = this.sequence[this.idx % this.sequence.length];
      const event: StateEvent = {
        tool: this.name,
        sessionId: "mock-session",
        state: current.state,
        reason: current.reason,
        source: current.source,
        ts: Date.now()
      };
      this.callbacks.forEach((callback) => callback(event));
      this.idx += 1;
    }, 5000);
  }

  async stop(): Promise<void> {
    this.stopTimer();
  }

  onEvent(callback: EventCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private stopTimer(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
