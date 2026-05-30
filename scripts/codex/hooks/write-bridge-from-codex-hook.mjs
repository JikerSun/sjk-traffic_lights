#!/usr/bin/env node

/**
 * Codex lifecycle hook entry — reads JSON payload from stdin.
 * Installed copy lives at ~/.codex/ai-traffic-lights/hooks/write-bridge-from-codex-hook.mjs
 */

import { appendCodexHookRecon } from "../lib/codex-hook-recon.mjs";
import {
  normalizeCodexHookPayload,
  resolveBridgePath,
  resolveProjectRootFromHook,
  getWorkspaceStateId
} from "../lib/codex-bridge-paths.mjs";
import { resolveCodexBridgeState } from "../lib/codex-bridge-resolve.mjs";
import { commitBridgeUpdate } from "../lib/commit-bridge.mjs";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";

const MANIFEST_PATH = resolve(homedir(), ".codex", "ai-traffic-lights", "install-manifest.json");

async function isReconOnlyInstall() {
  if (process.env.TRAFFIC_LIGHTS_CODEX_RECON === "1") {
    return true;
  }
  if (!existsSync(MANIFEST_PATH)) {
    return false;
  }
  try {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
    return manifest.reconOnly === true;
  } catch {
    return false;
  }
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { _parseError: raw.slice(0, 500) };
  }
}

function hookEventName(payload) {
  return (
    payload.hook_event_name ||
    payload.hookEventName ||
    payload.event_name ||
    payload.eventName ||
    "unknown"
  );
}

async function main() {
  const payload = await readStdinJson();
  const eventName = hookEventName(payload);
  const normalized = normalizeCodexHookPayload(payload);

  await appendCodexHookRecon(eventName, payload);

  if (await isReconOnlyInstall()) {
    process.exit(0);
  }

  const projectRoot = resolveProjectRootFromHook(normalized);
  const bridgePath = resolveBridgePath(projectRoot);
  const workspaceStateId = getWorkspaceStateId(projectRoot);
  const mapped = resolveCodexBridgeState({ eventName, payload: normalized });

  if (!mapped) {
    process.exit(0);
  }

  await commitBridgeUpdate({
    bridgePath,
    overlayBridgePath: bridgePath,
    mirrorOverlay: false,
    workspaceStateId,
    projectRoot,
    hookPayload: normalized,
    mapped,
    eventName,
    allowSingleWrite: true,
    toolName: "codex"
  });

  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`[ai-traffic-lights:codex] ${err?.stack || err}\n`);
  process.exit(0);
});
