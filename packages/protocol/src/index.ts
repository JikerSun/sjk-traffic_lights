export type AiState =
  | "IDLE"
  | "RUNNING"
  | "WAITING_USER"
  | "WAITING_PLAN_BUILD"
  | "DONE"
  | "ERROR";

export type ToolName = "cursor" | "codex" | "claude_code" | string;

export interface StateEvent {
  tool: ToolName;
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
