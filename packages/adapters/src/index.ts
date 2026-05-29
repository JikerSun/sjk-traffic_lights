import type { StateEvent } from "@traffic-lights/protocol";

export interface ToolAdapter {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  onEvent(callback: (event: StateEvent) => void): () => void;
}

export * from "./mockCursorAdapter.js";
