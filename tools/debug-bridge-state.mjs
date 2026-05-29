#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  resolveBridgePath,
  resolveOverlayBridgePath,
  shouldMirrorOverlayBridge,
  getWorkspaceStateDir
} from "../scripts/lib/bridge-paths.mjs";

const ROOT = resolve(process.cwd());
const BRIDGE_PATH = resolveBridgePath(ROOT);
const OVERLAY_BRIDGE_PATH = resolveOverlayBridgePath(ROOT);
const MIRROR_OVERLAY = shouldMirrorOverlayBridge(ROOT);
const INDEX_PATH = resolve(getWorkspaceStateDir(ROOT), "debug-index.json");

const VALID_STATES = new Set([
  "IDLE",
  "RUNNING",
  "WAITING_USER",
  "WAITING_PLAN_BUILD",
  "DONE",
  "ERROR"
]);

const STEPS = [
  { state: "RUNNING", reason: "Step 1/3: AI is solving", source: "debug-sequence" },
  { state: "WAITING_USER", reason: "Step 2/3: AI waits your confirmation", source: "debug-sequence" },
  { state: "DONE", reason: "Step 3/3: AI finished answer", source: "debug-sequence" }
];

async function ensurePaths() {
  await mkdir(dirname(BRIDGE_PATH), { recursive: true });
  if (MIRROR_OVERLAY) {
    await mkdir(dirname(OVERLAY_BRIDGE_PATH), { recursive: true });
  }
}

async function readIndex() {
  try {
    const raw = await readFile(INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Number.isInteger(parsed?.index) ? parsed.index : 0;
  } catch {
    return 0;
  }
}

async function writeIndex(index) {
  await writeFile(INDEX_PATH, JSON.stringify({ index }, null, 2), "utf8");
}

async function writeState({ state, reason, source = "debug-script", tool = "cursor", sessionId = "debug-session" }) {
  const payload = {
    tool,
    sessionId,
    state,
    reason,
    source,
    ts: Date.now()
  };
  const body = JSON.stringify(payload, null, 2);
  await writeFile(BRIDGE_PATH, body, "utf8");
  console.log(`Wrote ${payload.state} -> ${BRIDGE_PATH}`);
  if (MIRROR_OVERLAY) {
    await writeFile(OVERLAY_BRIDGE_PATH, body, "utf8");
    console.log(`Mirrored ${payload.state} -> ${OVERLAY_BRIDGE_PATH}`);
  }
  console.log(`Reason: ${payload.reason}`);
}

async function run() {
  await ensurePaths();
  const [cmd, ...rest] = process.argv.slice(2);

  if (!cmd || cmd === "help") {
    console.log(`Usage:
  node tools/debug-bridge-state.mjs set <STATE> [reason]
  node tools/debug-bridge-state.mjs next
  node tools/debug-bridge-state.mjs reset
  node tools/debug-bridge-state.mjs run-sequence [delayMs=2500]
`);
    return;
  }

  if (cmd === "set") {
    const state = rest[0];
    const reason = rest.slice(1).join(" ") || `Manual set to ${state}`;
    if (!state) {
      throw new Error("Missing state. Example: set RUNNING");
    }
    if (!VALID_STATES.has(state)) {
      throw new Error(
        `Unknown state "${state}". Valid: ${[...VALID_STATES].join(", ")}`
      );
    }
    await writeState({ state, reason });
    console.log("Tip: open STATUS LIGHTS panel (or Reload Window after extension update).");
    return;
  }

  if (cmd === "next") {
    const idx = await readIndex();
    const step = STEPS[idx % STEPS.length];
    await writeState(step);
    await writeIndex((idx + 1) % STEPS.length);
    console.log(`Step advanced to ${(idx + 1) % STEPS.length}`);
    return;
  }

  if (cmd === "reset") {
    await writeIndex(0);
    await writeState({ state: "IDLE", reason: "Debug sequence reset", source: "debug-sequence" });
    console.log("Sequence reset to Step 1.");
    return;
  }

  if (cmd === "run-sequence") {
    const delayMs = Number(rest[0] || 2500);
    if (!Number.isFinite(delayMs) || delayMs <= 0) {
      throw new Error("delayMs must be a positive number");
    }
    await writeIndex(0);
    for (let i = 0; i < STEPS.length; i += 1) {
      await writeState(STEPS[i]);
      if (i < STEPS.length - 1) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
      }
    }
    await writeIndex(0);
    console.log("Sequence finished.");
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
