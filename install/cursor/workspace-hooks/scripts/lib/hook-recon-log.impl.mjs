#!/usr/bin/env node

import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { readTranscriptRows, getAskQuestionPhase } from "./cursor-transcript-state.mjs";

function payloadToolName(payload) {
  return (
    payload?.tool_name ||
    payload?.toolName ||
    payload?.mcp_tool_name ||
    payload?.mcpToolName ||
    payload?.name ||
    ""
  );
}

export function looksLikeAskQuestion(payload) {
  const tool = String(payloadToolName(payload)).toLowerCase();
  return /^(askquestion|ask_question|ask-question)$/.test(tool) || tool === "elicitation";
}

function shrinkPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const copy = { ...payload };
  for (const key of ["tool_input", "toolInput", "tool_output", "toolOutput", "text"]) {
    if (typeof copy[key] === "string" && copy[key].length > 400) {
      copy[key] = `${copy[key].slice(0, 400)}…[truncated]`;
    }
  }
  return copy;
}

export async function appendHookRecon(projectRoot, eventName, payload) {
  const reconLogPath = resolve(projectRoot, ".ai-traffic-lights/recon-events.log");
  const reconSummaryPath = resolve(projectRoot, ".ai-traffic-lights/recon-summary.json");
  const transcriptPath = payload?.transcript_path || null;
  let transcriptPhase = "none";
  if (transcriptPath) {
    const rows = await readTranscriptRows(transcriptPath);
    transcriptPhase = getAskQuestionPhase(rows);
  }

  const entry = {
    ts: Date.now(),
    iso: new Date().toISOString(),
    event: eventName,
    tool_name: payloadToolName(payload) || null,
    ask_hint: looksLikeAskQuestion(payload),
    transcript_phase: transcriptPhase
  };

  await mkdir(dirname(reconLogPath), { recursive: true });
  await appendFile(reconLogPath, `${JSON.stringify(entry)}\n`, "utf8");
  await writeFile(reconSummaryPath, JSON.stringify({ lastEvent: entry }, null, 2), "utf8");
}
