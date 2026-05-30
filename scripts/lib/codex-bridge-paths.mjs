#!/usr/bin/env node

import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { homedir } from "node:os";

const CODEX_HOME = resolve(homedir(), ".codex");

/** User-level bridge root for Codex (mirrors Cursor layout, separate tree). */
export const CODEX_BRIDGE_ROOT = resolve(CODEX_HOME, "ai-traffic-lights");

export function normalizeWorkspaceRoot(projectRoot = process.cwd()) {
  return resolve(projectRoot);
}

export function getWorkspaceStateId(projectRoot = process.cwd()) {
  const root = normalizeWorkspaceRoot(projectRoot);
  return createHash("sha256").update(root).digest("hex").slice(0, 16);
}

export function getWorkspaceStateDir(projectRoot = process.cwd()) {
  return resolve(CODEX_BRIDGE_ROOT, "states", getWorkspaceStateId(projectRoot));
}

export function resolveBridgePath(projectRoot = process.cwd()) {
  return resolve(getWorkspaceStateDir(projectRoot), "state.json");
}

export function resolveReconDir() {
  const day = new Date().toISOString().slice(0, 10);
  return resolve(CODEX_BRIDGE_ROOT, "recon", day);
}

function isCodexHomePath(pathValue) {
  const normalized = resolve(pathValue);
  return normalized === CODEX_HOME || normalized.startsWith(`${CODEX_HOME}/ai-traffic-lights`);
}

/**
 * Codex hooks include `cwd` on common input fields (project working directory).
 */
export function resolveProjectRootFromHook(payload = {}, fallbackCwd = process.cwd()) {
  if (typeof payload?.cwd === "string" && payload.cwd.trim()) {
    const root = resolve(payload.cwd.trim());
    if (!isCodexHomePath(root)) {
      return root;
    }
  }

  if (typeof payload?.workspace_root === "string" && payload.workspace_root.trim()) {
    const root = resolve(payload.workspace_root.trim());
    if (!isCodexHomePath(root)) {
      return root;
    }
  }

  const roots = payload?.workspace_roots;
  if (Array.isArray(roots)) {
    for (const root of roots) {
      if (typeof root === "string" && root.trim() && !isCodexHomePath(root)) {
        return resolve(root.trim());
      }
    }
  }

  const fallback = resolve(fallbackCwd);
  if (!isCodexHomePath(fallback)) {
    return fallback;
  }

  return homedir();
}

/** Normalize Codex stdin payload field names for shared multi-agent helpers. */
export function normalizeCodexHookPayload(payload = {}) {
  const sessionId = payload.session_id || payload.sessionId || null;
  const turnId = payload.turn_id || payload.turnId || null;
  const agentId = payload.agent_id || payload.agentId || null;

  return {
    ...payload,
    session_id: sessionId,
    conversation_id: sessionId,
    turn_id: turnId,
    agent_id: agentId,
    subagent_id: agentId || payload.subagent_id || null
  };
}
