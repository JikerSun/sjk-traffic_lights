#!/usr/bin/env node

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  readTranscriptRows,
  getAskQuestionPhase,
  findLastAskQuestionIdx,
  readAskLatch,
  writeAskLatch,
  clearAskLatch,
  isAskLatchHoldingYellow,
  writeSessionTurn,
  readSessionTurn,
  clearSessionTurn,
  writeWatcherCursor,
  isAskQuestionUnresolved,
  isUserStillChoosingAsk,
  isInteractiveToolName,
  resolveStateFromTranscriptRows
} from "../../scripts/lib/cursor-transcript-state.mjs";
import {
  normalizePlanContext,
  mergePlanContext,
  isCreatePlanTool,
  isPlanFileWrite,
  marksPlanBuildStarted,
  isPlanArtifactPath,
  agentTextImpliesPlanAwaitingBuild,
  findRecentPlanArtifact
} from "../../scripts/lib/plan-session.mjs";
import { resolveBridgeState, shouldHookWriteBridge } from "../../scripts/lib/bridge-resolve.mjs";

const DEBUG = process.env.TRAFFIC_LIGHTS_DEBUG === "1";
const eventName = process.argv[2] || "unknown";
const cwd = process.cwd();

const bridgePath = resolve(cwd, ".ai-traffic-lights/state.json");
const overlayBridgePath = resolve(cwd, "apps/desktop-overlay/public/.ai-traffic-lights/state.json");
const activeSessionPath = resolve(cwd, ".ai-traffic-lights/active-session.json");

async function readStdin() {
  return new Promise((resolveInput) => {
    if (process.stdin.isTTY) {
      resolveInput("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolveInput(data.trim()));
    process.stdin.on("error", () => resolveInput(""));
    setTimeout(() => resolveInput(data.trim()), 1500);
  });
}

function parseHookPayload(raw) {
  if (!raw) {
    return {};
  }
  const clean = raw.replace(/^\uFEFF/, "").trim();
  if (!clean.startsWith("{")) {
    return {};
  }
  try {
    return JSON.parse(clean);
  } catch {
    return {};
  }
}

async function readHookPayload() {
  const fromEnv = parseHookPayload(process.env.HOOK_INPUT);
  const fromStdin = parseHookPayload(await readStdin());
  return { ...fromEnv, ...fromStdin };
}

async function writeBridge(payload) {
  const body = JSON.stringify(payload, null, 2);
  await mkdir(dirname(bridgePath), { recursive: true });
  await mkdir(dirname(overlayBridgePath), { recursive: true });
  await writeFile(bridgePath, body, "utf8");
  await writeFile(overlayBridgePath, body, "utf8");
}

async function getPreviousState() {
  try {
    const raw = await readFile(bridgePath, "utf8");
    return JSON.parse(raw)?.state || "IDLE";
  } catch {
    return "IDLE";
  }
}

async function writeActiveSession(payload, state) {
  const conversationId = payload?.conversation_id || payload?.session_id || null;
  if (!conversationId) {
    return;
  }
  await mkdir(dirname(activeSessionPath), { recursive: true });
  await writeFile(
    activeSessionPath,
    JSON.stringify(
      {
        conversationId,
        transcriptPath: payload?.transcript_path || null,
        lastEvent: eventName,
        lastState: state,
        ts: Date.now()
      },
      null,
      2
    ),
    "utf8"
  );
}

function getToolName(payload) {
  return payload?.tool_name || payload?.toolName || payload?.mcp_tool_name || payload?.name || "";
}

function isAskQuestionTool(toolName) {
  return /^askquestion$/i.test(String(toolName || "").replace(/[_\s-]/g, ""));
}

function syncAskPending(sessionTurn, { toolName, phase, rows, eventName, payload }) {
  const wasPending = sessionTurn?.askPending === true;
  const stopStatus = payload?.status || "";

  if (eventName === "beforeSubmitPrompt" || eventName === "sessionEnd") {
    return false;
  }
  if (phase === "agent_replying" || phase === "new_turn") {
    return false;
  }
  if (isAskQuestionTool(toolName)) {
    return true;
  }
  if (
    (eventName === "preToolUse" || eventName === "postToolUse" || eventName === "beforeMCPExecution") &&
    isInteractiveToolName(toolName)
  ) {
    return true;
  }
  if (eventName === "stop") {
    if (stopStatus === "aborted" && sessionTurn?.active) {
      return true;
    }
    if (
      (stopStatus === "completed" || stopStatus === "aborted") &&
      (phase === "awaiting_selection" || isAskQuestionUnresolved(rows))
    ) {
      return true;
    }
  }
  if (phase === "awaiting_selection" && isAskQuestionUnresolved(rows)) {
    return true;
  }
  // User clicked Continue — agent resumed with a normal tool.
  if (
    wasPending &&
    eventName === "preToolUse" &&
    !isAskQuestionTool(toolName) &&
    !isInteractiveToolName(toolName)
  ) {
    return false;
  }
  return wasPending;
}

async function updatePlanFromHook(payload, plan, sessionTurn) {
  const toolName = getToolName(payload);
  const toolInput = payload?.tool_input || payload?.toolInput || {};

  if (eventName === "beforeSubmitPrompt" || eventName === "sessionEnd") {
    return { ...normalizePlanContext(null) };
  }

  if (eventName === "postToolUse" && isCreatePlanTool(toolName)) {
    return mergePlanContext(plan, { awaitingBuild: true, buildStarted: false, touched: true });
  }

  if ((eventName === "preToolUse" || eventName === "postToolUse") && isPlanFileWrite(toolName, toolInput)) {
    return mergePlanContext(plan, {
      awaitingBuild: true,
      buildStarted: false,
      touched: true,
      lastPlanFile: toolTargetPath(toolInput) || plan.lastPlanFile
    });
  }

  if (eventName === "afterFileEdit" && isPlanArtifactPath(payload?.file_path || payload?.path)) {
    return mergePlanContext(plan, { awaitingBuild: true, buildStarted: false, touched: true });
  }

  if (eventName === "afterAgentResponse" && agentTextImpliesPlanAwaitingBuild(payload?.text || payload?.content)) {
    return mergePlanContext(plan, { awaitingBuild: true, buildStarted: false, touched: true });
  }

  if (
    (eventName === "preToolUse" || eventName === "postToolUse") &&
    plan.awaitingBuild &&
    marksPlanBuildStarted(toolName, toolInput)
  ) {
    return mergePlanContext(plan, { buildStarted: true, awaitingBuild: false });
  }

  // Completed turn = done. Do not scan ~/.cursor/plans on completed (stale .plan.md files
  // e.g. acceptance plans would wrongly force WAITING_PLAN_BUILD / red-yellow after reply ends).
  if (eventName === "stop" && payload?.status === "completed") {
    return { ...normalizePlanContext(null) };
  }

  if (eventName === "stop" && payload?.status === "aborted" && plan.touched && !plan.buildStarted) {
    const recent = await findRecentPlanArtifact(sessionTurn?.ts || 0);
    if (recent) {
      return mergePlanContext(plan, { awaitingBuild: true, lastPlanFile: recent });
    }
  }

  return plan;
}

function toolTargetPath(toolInput) {
  const ti = toolInput || {};
  return ti.path || ti.file_path || ti.filePath || ti.target_file || "";
}

const TRANSCRIPT_EVENTS = new Set([
  "beforeSubmitPrompt",
  "preToolUse",
  "postToolUse",
  "afterAgentResponse",
  "afterFileEdit",
  "stop",
  "sessionEnd"
]);

async function main() {
  const hookPayload = await readHookPayload();
  const transcriptPath = hookPayload?.transcript_path || null;
  const conversationId = hookPayload?.conversation_id || hookPayload?.session_id || null;
  const rows =
    TRANSCRIPT_EVENTS.has(eventName) && transcriptPath ? await readTranscriptRows(transcriptPath) : [];
  const phase = getAskQuestionPhase(rows);
  const toolName = getToolName(hookPayload);

  let sessionTurn = await readSessionTurn(cwd);
  let plan = normalizePlanContext(sessionTurn?.plan);
  plan = await updatePlanFromHook(hookPayload, plan, sessionTurn);

  const askIdx = findLastAskQuestionIdx(rows);
  let askLatch = await readAskLatch(cwd);
  const latchOk = askLatch?.conversationId && conversationId && askLatch.conversationId === conversationId;
  let askLatchActive = isAskLatchHoldingYellow(latchOk ? askLatch : null);

  if (eventName === "beforeSubmitPrompt") {
    await clearAskLatch(cwd);
    askLatchActive = false;
    plan = normalizePlanContext(null);
    const now = Date.now();
    sessionTurn = {
      active: true,
      conversationId,
      generationId: hookPayload?.generation_id || null,
      ts: now,
      lastHookAt: now,
      lastHookEvent: eventName,
      askPending: false,
      plan
    };
    await writeSessionTurn(cwd, sessionTurn);
    if (conversationId) {
      await writeWatcherCursor(cwd, { conversationId, lastAskIdx: askIdx, initialized: true, ts: now });
    }
    await writeBridge({
      tool: "cursor",
      sessionId: conversationId || "cursor-session",
      state: "RUNNING",
      reason: "New user prompt",
      source: "cursor-hook:beforeSubmitPrompt",
      ts: now
    });
    await writeActiveSession(hookPayload, "RUNNING");
    process.stdout.write(JSON.stringify({ continue: true }));
    return;
  }

  if (eventName === "sessionEnd") {
    await clearAskLatch(cwd);
    await clearSessionTurn(cwd);
    const mapped = resolveBridgeState({ eventName, payload: hookPayload, rows, sessionTurn, plan, toolName, phase });
    await writeBridge({
      tool: "cursor",
      sessionId: conversationId || "cursor-session",
      state: mapped.state,
      reason: mapped.reason,
      source: mapped.source,
      ts: Date.now()
    });
    return;
  }

  if (conversationId && askIdx >= 0 && phase === "awaiting_selection" && isAskQuestionUnresolved(rows)) {
    const isNewAsk = !latchOk || Number(askLatch?.askIdx) < askIdx;
    if (isNewAsk) {
      await writeAskLatch(cwd, {
        conversationId,
        askIdx,
        minHoldUntil: Date.now() + 1500,
        ts: Date.now()
      });
      askLatchActive = true;
    }
  }

  const askPending = syncAskPending(sessionTurn, { toolName, phase, rows, eventName, payload: hookPayload });
  if (!askPending) {
    await clearAskLatch(cwd);
    askLatchActive = false;
  } else if (isAskQuestionUnresolved(rows) === false) {
    await clearAskLatch(cwd);
    askLatchActive = false;
  }

  if (sessionTurn?.active) {
    sessionTurn = {
      ...sessionTurn,
      plan,
      askPending,
      lastHookAt: Date.now(),
      lastHookEvent: eventName
    };
    await writeSessionTurn(cwd, sessionTurn);
  }

  if (eventName === "stop" && hookPayload?.status === "completed" && !isAskQuestionUnresolved(rows)) {
    if (!plan.awaitingBuild || plan.buildStarted) {
      await clearAskLatch(cwd);
    }
    if (!plan.awaitingBuild) {
      await clearSessionTurn(cwd);
    }
  }

  const previousState = await getPreviousState();
  let mapped = resolveBridgeState({
    eventName,
    payload: hookPayload,
    rows,
    sessionTurn,
    plan,
    toolName,
    phase,
    askLatchActive
  });

  const stillChoosing = isUserStillChoosingAsk({
    rows,
    phase,
    sessionTurn: { ...sessionTurn, askPending },
    askLatchActive
  });
  const holdPlan = plan.awaitingBuild && !plan.buildStarted;

  const transcriptMapped = resolveStateFromTranscriptRows(rows);
  if (
    transcriptMapped.state === "WAITING_USER" &&
    transcriptMapped.phase === "awaiting_selection" &&
    eventName !== "beforeSubmitPrompt"
  ) {
    sessionTurn = { ...sessionTurn, askPending: true };
    await writeSessionTurn(cwd, sessionTurn);
    mapped = {
      state: "WAITING_USER",
      reason: transcriptMapped.reason,
      source: `cursor-hook:${eventName}+transcript`
    };
  }

  if (stillChoosing && mapped.state === "RUNNING" && eventName !== "beforeSubmitPrompt") {
    mapped = { state: "WAITING_USER", reason: "Ask pending", source: "cursor-hook:guard" };
  } else if (holdPlan && mapped.state === "RUNNING") {
    mapped = { state: "WAITING_PLAN_BUILD", reason: "Plan awaiting Build", source: "cursor-hook:guard" };
  }

  const shouldWrite = shouldHookWriteBridge(eventName, mapped, previousState, {
    toolName,
    stillChoosing,
    holdPlan
  });

  const forceYellowWrite =
    mapped.state === "WAITING_USER" &&
    (eventName === "stop" || stillChoosing || mapped.source?.includes("transcript"));

  if (shouldWrite || mapped.state !== previousState || forceYellowWrite) {
    await writeBridge({
      tool: "cursor",
      sessionId: conversationId || "cursor-session",
      state: mapped.state,
      reason: mapped.reason,
      source: mapped.source,
      ts: Date.now()
    });
    await writeActiveSession(hookPayload, mapped.state);
    if (DEBUG) {
      process.stderr.write(`[bridge] ${previousState} -> ${mapped.state} (${eventName})\n`);
    }
  }
}

main().catch(() => {
  if (eventName === "beforeSubmitPrompt") {
    process.stdout.write(JSON.stringify({ continue: true }));
  }
  process.exitCode = 0;
});
