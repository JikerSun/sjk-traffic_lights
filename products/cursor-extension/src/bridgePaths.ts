import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const GLOBAL_BRIDGE_ROOT = join(homedir(), ".cursor", "ai-traffic-lights");

export function getWorkspaceStateId(workspaceRootFsPath: string): string {
  const root = resolve(workspaceRootFsPath);
  return createHash("sha256").update(root).digest("hex").slice(0, 16);
}

export function getGlobalBridgeFilePath(workspaceRootFsPath: string): string {
  const id = getWorkspaceStateId(workspaceRootFsPath);
  return join(GLOBAL_BRIDGE_ROOT, "states", id, "state.json");
}

export function getLegacyBridgeFilePath(workspaceRootFsPath: string): string {
  return join(workspaceRootFsPath, ".ai-traffic-lights", "state.json");
}

/** Prefer user-level state; fall back to legacy per-project file. */
export function resolveBridgeFilePath(workspaceRootFsPath: string): string {
  const globalPath = getGlobalBridgeFilePath(workspaceRootFsPath);
  if (existsSync(globalPath)) {
    return globalPath;
  }
  const legacyPath = getLegacyBridgeFilePath(workspaceRootFsPath);
  if (existsSync(legacyPath)) {
    return legacyPath;
  }
  return globalPath;
}
