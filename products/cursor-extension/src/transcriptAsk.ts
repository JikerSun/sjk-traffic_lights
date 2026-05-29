/** Minimal AskQuestion detection (mirrors scripts/lib/cursor-transcript-state.mjs). */

export type AskPhase = "none" | "awaiting_selection" | "agent_replying" | "new_turn";

interface TranscriptRow {
  role?: string;
  message?: { content?: unknown };
}

interface SessionTurn {
  active?: boolean;
  askPending?: boolean;
  plan?: { awaitingBuild?: boolean; buildStarted?: boolean };
}

function parseJsonLines(text: string): TranscriptRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as TranscriptRow;
      } catch {
        return null;
      }
    })
    .filter((row): row is TranscriptRow => row !== null);
}

export function hasAskQuestion(content: unknown): boolean {
  if (!Array.isArray(content)) {
    return false;
  }
  return content.some(
    (block) =>
      block &&
      typeof block === "object" &&
      (block as { type?: string; name?: string }).type === "tool_use" &&
      String((block as { name?: string }).name || "").toLowerCase() === "askquestion"
  );
}

function hasAssistantText(content: unknown): boolean {
  if (!Array.isArray(content)) {
    return false;
  }
  return content.some(
    (block) =>
      block &&
      typeof block === "object" &&
      (block as { type?: string; text?: string }).type === "text" &&
      String((block as { text?: string }).text || "").trim().length > 0
  );
}

function getUserText(row: TranscriptRow): string {
  const content = row.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter((b) => b && typeof b === "object" && (b as { type?: string }).type === "text")
    .map((b) => String((b as { text?: string }).text || ""))
    .join("\n");
}

function isNewUserQuery(row: TranscriptRow): boolean {
  return row.role === "user" && /<user_query>/i.test(getUserText(row));
}

function hasUserQuestionResponse(row: TranscriptRow): boolean {
  return (
    row.role === "user" && /User questions responses|Selected option/i.test(getUserText(row))
  );
}

export function findLastAskQuestionIdx(rows: TranscriptRow[]): number {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row?.role === "assistant" && hasAskQuestion(row.message?.content)) {
      return i;
    }
  }
  return -1;
}

export function isAskQuestionUnresolved(rows: TranscriptRow[]): boolean {
  const lastAskIdx = findLastAskQuestionIdx(rows);
  if (lastAskIdx < 0) {
    return false;
  }
  const following = rows.slice(lastAskIdx + 1);
  if (following.length === 0) {
    return true;
  }
  for (const row of following) {
    if (row?.role === "user") {
      return false;
    }
    if (row?.role === "assistant") {
      if (hasAskQuestion(row.message?.content)) {
        continue;
      }
      if (hasAssistantText(row.message?.content)) {
        return false;
      }
    }
  }
  return true;
}

export function getAskQuestionPhase(rows: TranscriptRow[]): AskPhase {
  const lastAskIdx = findLastAskQuestionIdx(rows);
  if (lastAskIdx < 0) {
    return "none";
  }
  if (!isAskQuestionUnresolved(rows)) {
    const following = rows.slice(lastAskIdx + 1);
    for (const row of following) {
      if (row?.role === "user" && isNewUserQuery(row)) {
        return "new_turn";
      }
    }
    return "agent_replying";
  }
  return "awaiting_selection";
}

export function parseTranscriptRows(raw: string): TranscriptRow[] {
  return parseJsonLines(raw);
}

type BridgeState = "IDLE" | "RUNNING" | "WAITING_USER" | "WAITING_PLAN_BUILD" | "DONE" | "ERROR";

/**
 * Extension-side yellow supplement (does not fight RUNNING after Continue).
 */
export function shouldSupplementYellow(
  sessionTurn: SessionTurn | undefined,
  rows: TranscriptRow[],
  bridgeState?: BridgeState
): boolean {
  if (sessionTurn?.plan?.awaitingBuild && !sessionTurn?.plan?.buildStarted) {
    return false;
  }
  if (sessionTurn?.askPending === true) {
    return true;
  }
  if (bridgeState === "DONE" || bridgeState === "IDLE" || bridgeState === "ERROR") {
    return false;
  }
  if (getAskQuestionPhase(rows) !== "awaiting_selection") {
    return false;
  }
  return bridgeState === "RUNNING" && sessionTurn?.askPending !== false;
}
