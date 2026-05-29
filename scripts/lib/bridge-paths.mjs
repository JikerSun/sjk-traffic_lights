#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

/** User-level bridge root (all workspaces). */
export const GLOBAL_BRIDGE_ROOT = resolve(homedir(), ".cursor", "ai-traffic-lights");

export function normalizeWorkspaceRoot(projectRoot = process.cwd()) {
  return resolve(projectRoot);
}

/** Stable id per workspace folder (avoids cross-project state bleed). */
export function getWorkspaceStateId(projectRoot = process.cwd()) {
  const root = normalizeWorkspaceRoot(projectRoot);
  return createHash("sha256").update(root).digest("hex").slice(0, 16);
}

export function getWorkspaceStateDir(projectRoot = process.cwd()) {
  return resolve(GLOBAL_BRIDGE_ROOT, "states", getWorkspaceStateId(projectRoot));
}

export function resolveBridgePath(projectRoot = process.cwd()) {
  return resolve(getWorkspaceStateDir(projectRoot), "state.json");
}

export function resolveActiveSessionPath(projectRoot = process.cwd()) {
  return resolve(getWorkspaceStateDir(projectRoot), "active-session.json");
}

export function resolveLegacyBridgePath(projectRoot = process.cwd()) {
  return resolve(projectRoot, ".ai-traffic-lights", "state.json");
}

export function resolveOverlayBridgePath(projectRoot = process.cwd()) {
  return resolve(projectRoot, "products", "desktop-overlay", "public", ".ai-traffic-lights", "state.json");
}

export function shouldMirrorOverlayBridge(projectRoot = process.cwd()) {
  return existsSync(resolve(projectRoot, "products", "desktop-overlay", "public"));
}

export function resolveStateFilePath(projectRoot, fileName) {
  return resolve(getWorkspaceStateDir(projectRoot), fileName);
}
