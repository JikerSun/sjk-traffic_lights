# Adapter Spec

## Goal

Adapters translate vendor-specific signals into unified events.

## Contract

```ts
interface ToolAdapter {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  onEvent(callback: (event: StateEvent) => void): () => void;
}
```

## Normalized Event

```ts
interface StateEvent {
  tool: string;
  sessionId: string;
  state: "IDLE" | "RUNNING" | "WAITING_USER" | "DONE" | "ERROR";
  reason?: string;
  source?: string;
  ts: number;
}
```

## Mapping Guidance

- Processing/progress/tool-run -> `RUNNING`
- Input required/approval/prompt -> `WAITING_USER`
- Completion/stop success -> `DONE`
- Stream/turn failure -> `ERROR`

`WAITING_USER` should be emitted eagerly because it has highest UI priority.
