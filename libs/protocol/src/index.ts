export type AiState =
  | "IDLE"
  | "RUNNING"
  | "WAITING_USER"
  | "WAITING_PLAN_BUILD"
  | "DONE"
  | "ERROR";

export type ToolName = "cursor" | "codex" | "claude_code" | string;

export type DisplayMode = "single" | "multi";

export interface StateEvent {
  tool: ToolName;
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

export interface AgentRecord {
  state: AiState;
  reason?: string;
  source?: string;
  ts: number;
  lastHookTs: number;
  doneAt?: number;
}

export interface BridgeDocument extends StateEvent {
  workspaceRoot?: string;
  workspaceStateId?: string;
  bridgeVersion?: number;
  displayMode?: DisplayMode;
  counts?: BridgeCounts;
  agents?: Record<string, AgentRecord>;
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
