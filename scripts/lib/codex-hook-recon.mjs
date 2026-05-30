#!/usr/bin/env node

import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveReconDir } from "./codex-bridge-paths.mjs";

/**
 * Append one Codex hook payload line for Phase 0 recon.
 * @param {string} eventName
 * @param {Record<string, unknown>} payload
 */
export async function appendCodexHookRecon(eventName, payload) {
  const dir = resolveReconDir();
  await mkdir(dir, { recursive: true });
  const file = join(dir, "hook-events.jsonl");
  const line = JSON.stringify({
    ts: Date.now(),
    eventName,
    payload
  });
  await appendFile(file, `${line}\n`, "utf8");
}
