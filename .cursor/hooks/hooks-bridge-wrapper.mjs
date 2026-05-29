#!/usr/bin/env node

/**
 * Plan B recon: log every hook event, then forward to bridge writer unchanged.
 * Usage: hooks.json points here instead of write-bridge-from-hook.mjs directly.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readTranscriptRows, getAskQuestionPhase } from "../../scripts/lib/cursor-transcript-state.mjs";

const eventName = process.argv[2] || "unknown";
const cwd = process.cwd();
const here = dirname(fileURLToPath(import.meta.url));
const bridgeScript = resolve(here, "write-bridge-from-hook.mjs");
const reconLogPath = resolve(cwd, ".ai-traffic-lights/recon-events.log");
const reconSummaryPath = resolve(cwd, ".ai-traffic-lights/recon-summary.json");

function readStdin() {
  return new Promise((resolveInput) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolveInput(data));
    process.stdin.on("error", () => resolveInput(""));
  });
}

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

function looksLikeAskQuestion(payload) {
  const tool = String(payloadToolName(payload)).toLowerCase();
  if (/ask.?question|elicitation|user.?input|multiple.?choice/.test(tool)) {
    return true;
  }
  const blob = JSON.stringify(payload || {}).toLowerCase();
  return blob.includes("askquestion") || blob.includes("\"questions\"");
}

function shrinkPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const copy = { ...payload };
  for (const key of ["tool_input", "toolInput", "tool_output", "toolOutput", "text"]) {
    if (typeof copy[key] === "string" && copy[key].length > 400) {
      copy[key] = `${copy[key].slice(0, 400)}…[truncated ${copy[key].length} chars]`;
    }
  }
  return copy;
}

async function appendRecon(line) {
  await mkdir(dirname(reconLogPath), { recursive: true });
  await appendFile(reconLogPath, `${JSON.stringify(line)}\n`, "utf8");
}

async function writeSummary(summary) {
  await mkdir(dirname(reconSummaryPath), { recursive: true });
  await writeFileCompat(reconSummaryPath, JSON.stringify(summary, null, 2));
}

async function writeFileCompat(path, body) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path, body, "utf8");
}

async function logRecon(stdinRaw, payload) {
  const transcriptPath = payload?.transcript_path || null;
  let transcriptPhase = "none";
  let transcriptRows = 0;
  if (transcriptPath) {
    const rows = await readTranscriptRows(transcriptPath);
    transcriptRows = rows.length;
    transcriptPhase = getAskQuestionPhase(rows);
  }

  const entry = {
    ts: Date.now(),
    iso: new Date().toISOString(),
    event: eventName,
    hook_event_name: payload?.hook_event_name || eventName,
    tool_name: payloadToolName(payload) || null,
    stop_status: payload?.status || null,
    conversation_id: payload?.conversation_id || payload?.session_id || null,
    generation_id: payload?.generation_id || null,
    cursor_version: payload?.cursor_version || null,
    ask_hint: looksLikeAskQuestion(payload),
    transcript_phase: transcriptPhase,
    transcript_rows: transcriptRows,
    prompt_preview: payload?.prompt ? String(payload.prompt).slice(0, 80) : null,
    text_preview: payload?.text ? String(payload.text).slice(0, 80) : null,
    payload: shrinkPayload(payload)
  };

  await appendRecon(entry);
  await writeSummary({
    lastEvent: entry.event,
    lastTs: entry.ts,
    lastIso: entry.iso,
    lastTool: entry.tool_name,
    lastAskHint: entry.ask_hint,
    lastTranscriptPhase: entry.transcript_phase,
    logPath: reconLogPath
  });

  if (entry.ask_hint) {
    process.stderr.write(
      `[recon] ★ ${entry.iso} ${entry.event} tool=${entry.tool_name || "?"} phase=${entry.transcript_phase}\n`
    );
  }
}

async function runBridgeHook(stdinRaw) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [bridgeScript, eventName], {
      cwd,
      stdio: ["pipe", "pipe", "inherit"],
      env: process.env
    });

    let stdout = "";
    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise(code ?? 0);
    });

    if (stdinRaw) {
      child.stdin.write(stdinRaw);
    }
    child.stdin.end();
  });
}

async function main() {
  const stdinRaw = await readStdin();
  let payload = {};
  if (stdinRaw) {
    try {
      payload = JSON.parse(stdinRaw);
    } catch {
      payload = { _parseError: true, _rawPreview: stdinRaw.slice(0, 200) };
    }
  }

  await logRecon(stdinRaw, payload);
  const code = await runBridgeHook(stdinRaw);
  process.exitCode = code;
}

main().catch((error) => {
  process.stderr.write(`[recon] wrapper failed: ${error.message}\n`);
  if (eventName === "beforeSubmitPrompt") {
    process.stdout.write(JSON.stringify({ continue: true }));
  }
  process.exitCode = 0;
});
