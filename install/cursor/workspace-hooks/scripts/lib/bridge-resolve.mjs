#!/usr/bin/env node

import {
  getAskQuestionPhase,
  isAskQuestionUnresolved,
  shouldInferIdleWaitingForUser,
  isInteractiveToolName,
  isUserStillChoosingAsk
} from "./cursor-transcript-state.mjs";
import { shouldStayPlanAwaiting, agentTextImpliesPlanAwaitingBuild } from "./plan-session.mjs";

/** @typedef {"IDLE"|"RUNNING"|"WAITING_USER"|"WAITING_PLAN_BUILD"|"DONE"|"ERROR"} BridgeState */

/**
 * Pick final bridge state from hook + transcript + plan session (single pass).
 */
export function resolveBridgeState({
  eventName,
  payload = {},
  rows = [],
  sessionTurn = { active: false },
  plan = { awaitingBuild: false, buildStarted: false },
  toolName = "",
  phase: phaseIn,
  askLatchActive = false
}) {
  const phase = phaseIn || getAskQuestionPhase(rows);
  const unresolvedAsk = isAskQuestionUnresolved(rows);
  const planWaiting = shouldStayPlanAwaiting(plan);
  const stillChoosing = isUserStillChoosingAsk({
    rows,
    phase,
    sessionTurn,
    askLatchActive
  });
  const idleWaiting =
    shouldInferIdleWaitingForUser({ sessionTurn, rows }) && !planWaiting;

  const status = payload?.status || "";
  const text = String(payload?.text || payload?.content || "");

  if (eventName === "watcher") {
    if (planWaiting) {
      return { state: "WAITING_PLAN_BUILD", reason: "Plan awaiting Build", source: "cursor-watcher" };
    }
    if (phase === "agent_replying") {
      return { state: "RUNNING", reason: "Agent working", source: "cursor-watcher" };
    }
    if (stillChoosing || idleWaiting) {
      return {
        state: "WAITING_USER",
        reason: idleWaiting ? "Questions UI (idle)" : "AskQuestion pending",
        source: "cursor-watcher"
      };
    }
    return null;
  }

  if (eventName === "sessionEnd") {
    return { state: "IDLE", reason: "Session ended", source: "cursor-hook:sessionEnd" };
  }

  if (eventName === "postToolUseFailure") {
    return { state: "ERROR", reason: "Tool failed", source: "cursor-hook:postToolUseFailure" };
  }

  if (eventName === "beforeSubmitPrompt") {
    return {
      state: "RUNNING",
      reason: payload?.prompt ? `Prompt: ${String(payload.prompt).slice(0, 60)}` : "New turn",
      source: "cursor-hook:beforeSubmitPrompt"
    };
  }

  if (eventName === "stop") {
    if (status === "error") {
      return { state: "ERROR", reason: "Agent error", source: "cursor-hook:stop" };
    }
    if (status === "aborted") {
      if (planWaiting) {
        return { state: "WAITING_PLAN_BUILD", reason: "Plan ready — click Build", source: "cursor-hook:stop" };
      }
      // Cursor pauses the agent loop for AskQuestion before transcript rows land.
      if (sessionTurn?.active || unresolvedAsk || phase === "awaiting_selection") {
        return { state: "WAITING_USER", reason: "Agent paused for user", source: "cursor-hook:stop" };
      }
      return { state: "ERROR", reason: "Agent aborted", source: "cursor-hook:stop" };
    }
    if (status === "completed") {
      if (stillChoosing || idleWaiting) {
        return {
          state: "WAITING_USER",
          reason: idleWaiting ? "Questions UI (idle)" : "AskQuestion pending",
          source: "cursor-hook:stop"
        };
      }
      // Plan-wait is signaled via stop(aborted) or in-turn hooks — not on completed (avoids
      // false red/yellow after a normal reply when any recent *.plan.md exists on disk).
      return {
        state: "DONE",
        reason: "Turn complete",
        source: "cursor-hook:stop"
      };
    }
    return { state: "RUNNING", reason: `Stop: ${status || "unknown"}`, source: "cursor-hook:stop" };
  }

  if (isInteractiveToolName(toolName) || /^askquestion$/i.test(String(toolName || "").replace(/[_\s-]/g, ""))) {
    return {
      state: "WAITING_USER",
      reason: `Waiting: ${toolName || "question"}`,
      source: `cursor-hook:${eventName}`
    };
  }

  if (eventName === "afterAgentResponse" && agentTextImpliesPlanAwaitingBuild(text) && !plan.buildStarted) {
    return {
      state: "WAITING_PLAN_BUILD",
      reason: "Plan awaiting Build",
      source: "cursor-hook:afterAgentResponse+plan"
    };
  }

  if (planWaiting && (eventName === "afterAgentResponse" || eventName === "afterFileEdit")) {
    return {
      state: "WAITING_PLAN_BUILD",
      reason: "Plan awaiting Build",
      source: `cursor-hook:${eventName}+plan`
    };
  }

  if (stillChoosing || idleWaiting) {
    return {
      state: "WAITING_USER",
      reason: idleWaiting ? "Questions UI (idle)" : "AskQuestion pending",
      source: `cursor-hook:${eventName}+ask`
    };
  }

  if (
    eventName === "preToolUse" ||
    eventName === "postToolUse" ||
    eventName === "beforeMCPExecution" ||
    eventName === "afterMCPExecution" ||
    eventName === "afterAgentThought"
  ) {
    return {
      state: "RUNNING",
      reason: toolName ? `Tool: ${toolName}` : "Agent working",
      source: `cursor-hook:${eventName}`
    };
  }

  if (eventName === "afterAgentResponse") {
    return {
      state: "RUNNING",
      reason: "Assistant responding",
      source: "cursor-hook:afterAgentResponse"
    };
  }

  if (eventName === "afterFileEdit") {
    return { state: "RUNNING", reason: "File edited", source: "cursor-hook:afterFileEdit" };
  }

  return { state: "RUNNING", reason: "Agent active", source: `cursor-hook:${eventName}` };
}

export function statePriority(state) {
  switch (state) {
    case "ERROR":
      return 6;
    case "WAITING_USER":
      return 5;
    case "WAITING_PLAN_BUILD":
      return 4;
    case "RUNNING":
      return 3;
    case "DONE":
      return 2;
    case "IDLE":
      return 1;
    default:
      return 0;
  }
}

export function shouldHookWriteBridge(eventName, mapped, previousState, options = {}) {
  const toolName = options.toolName || "";
  const stillChoosing = Boolean(options.stillChoosing);

  if (eventName === "beforeSubmitPrompt" || eventName === "stop" || eventName === "sessionEnd") {
    return true;
  }
  if (mapped.state === "ERROR" || mapped.state === "DONE" || mapped.state === "WAITING_USER" || mapped.state === "WAITING_PLAN_BUILD") {
    return true;
  }
  if (isInteractiveToolName(toolName)) {
    return true;
  }
  if (stillChoosing && mapped.state === "RUNNING" && previousState === "WAITING_USER") {
    return false;
  }
  if (options.holdPlan && mapped.state === "RUNNING" && previousState === "WAITING_PLAN_BUILD") {
    return false;
  }
  if (
    eventName === "preToolUse" ||
    eventName === "postToolUse" ||
    eventName === "afterAgentResponse" ||
    eventName === "afterAgentThought" ||
    eventName === "beforeMCPExecution" ||
    eventName === "afterMCPExecution" ||
    eventName === "afterFileEdit"
  ) {
    return false;
  }
  return mapped.state !== previousState;
}
