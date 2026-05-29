#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { resolveStateFilePath } from "./bridge-paths.mjs";

/** @typedef {"IDLE"|"RUNNING"|"WAITING_USER"|"WAITING_PLAN_BUILD"|"DONE"|"ERROR"} AiState */
/** @typedef {"none"|"awaiting_selection"|"agent_replying"|"new_turn"} AskQuestionPhase */

export function parseJsonLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function hasAskQuestion(content) {
  if (!Array.isArray(content)) {
    return false;
  }
  return content.some(
    (block) => block?.type === "tool_use" && String(block?.name || "").toLowerCase() === "askquestion"
  );
}

export function hasAssistantText(content) {
  if (!Array.isArray(content)) {
    return false;
  }
  return content.some((block) => block?.type === "text" && String(block?.text || "").trim().length > 0);
}

export function isInteractiveToolName(toolName) {
  const name = String(toolName || "").toLowerCase();
  return /(ask[_\s-]?question|askquestion|elicitation|permission|approval|confirm|user[_\s-]?input|multiple[-_\s]?choice)/.test(
    name
  );
}

export function getUserText(row) {
  const content = row?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter((block) => block?.type === "text")
    .map((block) => String(block?.text || ""))
    .join("\n");
}

export function hasUserQuestionResponse(row) {
  if (row?.role !== "user") {
    return false;
  }
  return /User questions responses|Selected option/i.test(getUserText(row));
}

export function isNewUserQuery(row) {
  if (row?.role !== "user") {
    return false;
  }
  return /<user_query>/i.test(getUserText(row));
}

/**
 * AskQuestion lifecycle in Cursor transcripts (observed on real sessions):
 * - awaiting_selection: AskQuestion row written, user UI still open (no following rows yet)
 * - agent_replying: user picked an option; assistant follow-up text appears (often no user row)
 * - new_turn: user sent a new <user_query> after the Q&A
 */
export function findLastAskQuestionIdx(rows) {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row?.role === "assistant" && hasAskQuestion(row?.message?.content)) {
      return i;
    }
  }
  return -1;
}

/** True while the latest AskQuestion in transcript has no answer rows after it. */
export function isAskQuestionUnresolved(rows) {
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
      if (hasUserQuestionResponse(row)) {
        return false;
      }
      if (isNewUserQuery(row)) {
        return false;
      }
      return false;
    }
    if (row?.role === "assistant") {
      if (hasAskQuestion(row?.message?.content)) {
        continue;
      }
      if (hasAssistantText(row?.message?.content)) {
        return false;
      }
    }
  }
  return true;
}

export function getAskQuestionPhase(rows) {
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

/** Hook silence while Questions UI is open (only after AskQuestion is known). */
export const IDLE_YELLOW_MS = 3500;

export function shouldInferIdleWaitingForUser({ sessionTurn, rows, now = Date.now() }) {
  if (!sessionTurn?.active || sessionTurn?.askPending !== true) {
    return false;
  }
  if (sessionTurn?.plan?.awaitingBuild && !sessionTurn?.plan?.buildStarted) {
    return false;
  }
  const lastHookAt = Number(sessionTurn.lastHookAt || sessionTurn.ts || 0);
  if (now - lastHookAt < IDLE_YELLOW_MS) {
    return false;
  }
  return isAskQuestionUnresolved(rows) || sessionTurn.askPending === true;
}

/** User is still on the Questions panel (not yet resumed agent work). */
export function isUserStillChoosingAsk({ rows, phase, sessionTurn, askLatchActive }) {
  if (phase === "agent_replying" || phase === "new_turn") {
    return false;
  }
  if (sessionTurn?.askPending === true || askLatchActive) {
    return true;
  }
  if (phase === "awaiting_selection" && isAskQuestionUnresolved(rows)) {
    return true;
  }
  return false;
}

export function resolveAskLatchPath(projectRoot = process.cwd()) {
  return resolveStateFilePath(projectRoot, "ask-latch.json");
}

export async function readAskLatch(projectRoot = process.cwd()) {
  try {
    const raw = await readFile(resolveAskLatchPath(projectRoot), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeAskLatch(projectRoot, latch) {
  const path = resolveAskLatchPath(projectRoot);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(latch, null, 2), "utf8");
}

export async function clearAskLatch(projectRoot = process.cwd()) {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(resolveAskLatchPath(projectRoot));
  } catch {
    // ignore
  }
}

export const ASK_YELLOW_MIN_HOLD_MS = 1200;

export function isAskLatchHoldingYellow(latch, now = Date.now()) {
  if (!latch) {
    return false;
  }
  return Number(latch.minHoldUntil || 0) > now;
}

export function resolveWatcherCursorPath(projectRoot = process.cwd()) {
  return resolveStateFilePath(projectRoot, "watcher-cursor.json");
}

export async function readWatcherCursor(projectRoot = process.cwd()) {
  try {
    const raw = await readFile(resolveWatcherCursorPath(projectRoot), "utf8");
    return JSON.parse(raw);
  } catch {
    return { conversationId: null, lastAskIdx: -1 };
  }
}

export async function writeWatcherCursor(projectRoot, cursor) {
  const path = resolveWatcherCursorPath(projectRoot);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(cursor, null, 2), "utf8");
}

/**
 * Single source of truth for transcript -> traffic light state.
 */
export function resolveStateFromTranscriptRows(rows) {
  if (!rows.length) {
    return { state: "IDLE", reason: "transcript empty", phase: "none" };
  }

  const phase = getAskQuestionPhase(rows);

  if (phase === "awaiting_selection" || isAskQuestionUnresolved(rows)) {
    return { state: "WAITING_USER", reason: "AskQuestion awaiting selection", phase };
  }

  if (phase === "agent_replying") {
    return { state: "RUNNING", reason: "post-selection agent reply", phase };
  }

  const last = rows[rows.length - 1];
  if (last?.role === "user") {
    return { state: "RUNNING", reason: "latest row is user prompt", phase };
  }
  if (last?.role === "assistant") {
    if (hasAskQuestion(last?.message?.content) && phase === "none") {
      return { state: "WAITING_USER", reason: "latest row is AskQuestion", phase: "awaiting_selection" };
    }
    return { state: "RUNNING", reason: "latest row is assistant (turn in progress)", phase };
  }

  return { state: "RUNNING", reason: "default inference", phase };
}

export async function readTranscriptRows(transcriptPath) {
  if (!transcriptPath) {
    return [];
  }
  try {
    const raw = await readFile(transcriptPath, "utf8");
    return parseJsonLines(raw);
  } catch {
    return [];
  }
}

export async function resolveStateFromTranscriptPath(transcriptPath) {
  const rows = await readTranscriptRows(transcriptPath);
  return resolveStateFromTranscriptRows(rows);
}

export function shouldPreserveWaitingUser(phase, askLatchActive, options = {}) {
  if (phase === "awaiting_selection") {
    return true;
  }
  if (options.idleWaiting) {
    return true;
  }
  if (options.unresolvedAsk) {
    return true;
  }
  // Latch extends yellow only before selection is reflected in transcript.
  return Boolean(askLatchActive) && phase !== "agent_replying" && phase !== "new_turn";
}

/** Hook should not clobber watcher yellow with RUNNING on every tool event. */
export function shouldHookWriteBridge(eventName, mapped, previousState, options = {}) {
  const toolName = options.toolName || "";
  const preserveYellow = Boolean(options.preserveYellow);

  if (eventName === "beforeSubmitPrompt" || eventName === "stop") {
    return true;
  }
  if (mapped.state === "WAITING_USER" || mapped.state === "DONE" || mapped.state === "ERROR") {
    return true;
  }
  if (isInteractiveToolName(toolName)) {
    return true;
  }
  if (preserveYellow && mapped.state === "RUNNING") {
    return false;
  }
  if (previousState === "WAITING_USER" && mapped.state === "RUNNING") {
    return false;
  }
  if (
    eventName === "preToolUse" ||
    eventName === "postToolUse" ||
    eventName === "afterAgentResponse" ||
    eventName === "afterAgentThought" ||
    eventName === "beforeMCPExecution" ||
    eventName === "afterMCPExecution"
  ) {
    return false;
  }
  return mapped.state !== previousState;
}

export function resolveSessionTurnPath(projectRoot = process.cwd()) {
  return resolveStateFilePath(projectRoot, "session-turn.json");
}

export async function readSessionTurn(projectRoot = process.cwd()) {
  try {
    const raw = await readFile(resolveSessionTurnPath(projectRoot), "utf8");
    return JSON.parse(raw);
  } catch {
    return { active: false };
  }
}

export async function writeSessionTurn(projectRoot, turn) {
  const path = resolveSessionTurnPath(projectRoot);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(turn, null, 2), "utf8");
}

export async function clearSessionTurn(projectRoot = process.cwd()) {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(resolveSessionTurnPath(projectRoot));
  } catch {
    // ignore
  }
}

export function mapHookEventToState(event, payload, transcriptState, options = {}) {
  const toolName =
    payload?.tool_name || payload?.toolName || payload?.mcp_tool_name || payload?.mcpToolName || payload?.name || "";
  const phase = transcriptState?.phase || options?.phase || "none";
  const askLatchActive = Boolean(options?.askLatchActive);
  const idleWaiting = Boolean(options?.idleWaiting);
  const unresolvedAsk = Boolean(options?.unresolvedAsk);
  const preserveYellow = shouldPreserveWaitingUser(phase, askLatchActive, {
    idleWaiting,
    unresolvedAsk
  });

  if (event === "beforeSubmitPrompt") {
    return {
      state: "RUNNING",
      reason: payload?.prompt ? `Prompt: ${String(payload.prompt).slice(0, 60)}` : "AI started",
      source: `cursor-hook:${event}`
    };
  }

  if (event === "afterAgentThought") {
    return {
      state: "RUNNING",
      reason: "Agent thinking",
      source: `cursor-hook:${event}`
    };
  }

  if (event === "preToolUse" || event === "postToolUse" || event === "beforeMCPExecution" || event === "afterMCPExecution") {
    if (isInteractiveToolName(toolName)) {
      return {
        state: "WAITING_USER",
        reason: `Interactive tool: ${toolName || "unknown"}`,
        source: `cursor-hook:${event}`
      };
    }
    if (preserveYellow) {
      return {
        state: "WAITING_USER",
        reason: "AskQuestion pending (keep yellow during tools)",
        source: `cursor-hook:${event}+ask`
      };
    }
    return {
      state: "RUNNING",
      reason: `Tool: ${toolName || "unknown"}`,
      source: `cursor-hook:${event}`
    };
  }

  if (event === "afterAgentResponse") {
    if (preserveYellow && phase !== "agent_replying") {
      return {
        state: "WAITING_USER",
        reason: transcriptState.reason || "AskQuestion awaiting selection",
        source: `cursor-hook:${event}+transcript`
      };
    }
    return {
      state: "RUNNING",
      reason: "Assistant response in progress",
      source: `cursor-hook:${event}`
    };
  }

  if (event === "stop") {
    if (payload?.status === "error") {
      return { state: "ERROR", reason: "Agent error", source: `cursor-hook:${event}` };
    }
    if (payload?.status === "aborted") {
      if (phase === "awaiting_selection") {
        return {
          state: "WAITING_USER",
          reason: transcriptState.reason,
          source: `cursor-hook:${event}+transcript`
        };
      }
      return {
        state: "WAITING_USER",
        reason: "Agent aborted, waiting for user",
        source: `cursor-hook:${event}`
      };
    }

    if (payload?.status === "completed") {
      if (phase === "awaiting_selection" || unresolvedAsk || idleWaiting) {
        return {
          state: "WAITING_USER",
          reason: unresolvedAsk || phase === "awaiting_selection"
            ? "AskQuestion awaiting selection"
            : "Agent idle (likely Questions UI)",
          source: `cursor-hook:${event}+transcript`
        };
      }
      return {
        state: "DONE",
        reason: phase === "agent_replying" ? "Selection answered, turn complete" : "Agent loop completed",
        source: `cursor-hook:${event}`
      };
    }

    return {
      state: "RUNNING",
      reason: `Agent stop: ${payload?.status || "unknown"}`,
      source: `cursor-hook:${event}`
    };
  }

  return {
    state: "RUNNING",
    reason: `Unhandled: ${event}`,
    source: `cursor-hook:${event}`
  };
}

export function statePriority(state) {
  if (state === "WAITING_USER") return 4;
  if (state === "RUNNING") return 3;
  if (state === "DONE") return 2;
  if (state === "IDLE") return 1;
  return 0;
}

export function pickHigherPriorityState(a, b) {
  return statePriority(a.state) >= statePriority(b.state) ? a : b;
}
