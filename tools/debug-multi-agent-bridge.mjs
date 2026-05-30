#!/usr/bin/env node

/**
 * Multi Agent bridge debug + UI isolation tests.
 *
 * Use this to verify Sidebar badges WITHOUT real parallel Cursor agents.
 * Also inspects live bridge to explain why Multi mode may not activate.
 */

import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { watch as fsWatch, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  resolveBridgePath,
  resolveOverlayBridgePath,
  shouldMirrorOverlayBridge,
  getWorkspaceStateId,
  getWorkspaceStateDir
} from "../scripts/lib/bridge-paths.mjs";
import {
  buildMultiDocument,
  buildSingleDocument,
  computeCounts,
  hydrateAgentsFromDocument,
  pruneAgents
} from "../scripts/lib/multi-agent-bridge.mjs";
import { commitBridgeUpdate } from "../scripts/lib/commit-bridge.mjs";

const ROOT = resolve(process.cwd());
const BRIDGE_PATH = resolveBridgePath(ROOT);
const OVERLAY_BRIDGE_PATH = resolveOverlayBridgePath(ROOT);
const MIRROR_OVERLAY = shouldMirrorOverlayBridge(ROOT);
const WORKSPACE_STATE_ID = getWorkspaceStateId(ROOT);
const STATE_DIR = getWorkspaceStateDir(ROOT);

const VALID_STATES = new Set([
  "IDLE",
  "RUNNING",
  "WAITING_USER",
  "WAITING_PLAN_BUILD",
  "DONE",
  "ERROR"
]);

async function ensurePaths() {
  await mkdir(dirname(BRIDGE_PATH), { recursive: true });
  if (MIRROR_OVERLAY) {
    await mkdir(dirname(OVERLAY_BRIDGE_PATH), { recursive: true });
  }
}

async function readBridge() {
  try {
    const raw = await readFile(BRIDGE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeBridgeDoc(document) {
  const body = JSON.stringify(document, null, 2);
  await writeFile(BRIDGE_PATH, body, "utf8");
  if (MIRROR_OVERLAY) {
    await writeFile(OVERLAY_BRIDGE_PATH, body, "utf8");
  }
}

function workspaceMeta() {
  return { workspaceStateId: WORKSPACE_STATE_ID, workspaceRoot: ROOT };
}

function printHelp() {
  console.log(`Multi Agent bridge debug (workspace: ${ROOT})

Bridge file:
  ${BRIDGE_PATH}

Commands:
  inspect                     Diagnose current bridge (mode, counts, agents)
  watch                       Print bridge file on every change (Ctrl+C stop)

  ui-test running [N=3]       Write Multi: N agents RUNNING → expect red badge N
  ui-test mixed               Write Multi: 2 RUNNING + 2 DONE → red "2" + green "2"
  ui-test error               Write Multi: 1 ERROR + 3 RUNNING → red blink badge "1"
  ui-test single              Write Single RUNNING → red on, NO badge
  reset                       Write Single IDLE (keep other cache files)
  clear                       Full cleanup before real-agent test (recommended)

  simulate add <id> <STATE>   Merge one agent via commitBridgeUpdate (hook path)
  simulate done <id>          Mark agent DONE (keeps others)
  simulate end <id>           sessionEnd for one agent id

  sequence mixed [delayMs=2000]
                              Step through: 3 running → partial done → single

Examples:
  node tools/debug-multi-agent-bridge.mjs inspect
  node tools/debug-multi-agent-bridge.mjs ui-test running 3
  node tools/debug-multi-agent-bridge.mjs ui-test mixed
  node tools/debug-multi-agent-bridge.mjs simulate add agent-a RUNNING
  node tools/debug-multi-agent-bridge.mjs simulate add agent-b RUNNING

After ui-test: open Status Lights sidebar (Reload Window if needed).
If badges appear here but NOT with real agents → hook/agent-id issue; run:
  npm run install:global-hooks
  TRAFFIC_LIGHTS_DEBUG=1  (optional hook stderr)
`);
}

function diagnose(doc) {
  if (!doc) {
    console.log("No bridge file yet.");
    console.log("Run: node tools/debug-multi-agent-bridge.mjs ui-test running 3");
    return;
  }

  const mode = doc.displayMode === "multi" ? "multi" : "single";
  const agents = hydrateAgentsFromDocument(doc);
  const agentIds = Object.keys(agents);
  const counts = doc.counts || (agentIds.length ? computeCounts(agents) : null);

  console.log("=== Bridge diagnose ===");
  console.log(`Path:         ${BRIDGE_PATH}`);
  console.log(`Top state:    ${doc.state}`);
  console.log(`displayMode:  ${mode}`);
  console.log(`bridgeVersion:${doc.bridgeVersion ?? 1}`);
  console.log(`sessionId:    ${doc.sessionId ?? "-"}`);
  console.log(`reason:       ${doc.reason ?? "-"}`);
  console.log(`ts:           ${doc.ts ?? "-"}`);

  if (counts) {
    console.log(
      `counts:       running=${counts.running} waiting=${counts.waiting} done=${counts.done} error=${counts.error}`
    );
  } else {
    console.log("counts:       (none — single mode)");
  }

  console.log(`agents (${agentIds.length}):`);
  if (!agentIds.length) {
    console.log("  (empty — expected in pure single v1 writes)");
  } else {
    for (const id of agentIds) {
      const a = agents[id];
      console.log(`  - ${id.slice(0, 48)}${id.length > 48 ? "…" : ""} → ${a.state}`);
    }
  }

  console.log("");
  if (mode === "single" && agentIds.length >= 2) {
    console.log("⚠ Inconsistent: hydrated >=2 agents but displayMode is single.");
  }
  if (mode === "single" && doc.state === "RUNNING") {
    console.log("UI expectation: red ON, NO number badge (single mode).");
    console.log("If you expected Multi badges, likely causes:");
    console.log("  1) Only 1 agent id in hook map (same conversation_id across parallel agents)");
    console.log("  2) v1 bridge lost prior agent before fix — reinstall hooks:");
    console.log("       npm run install:global-hooks");
    console.log("  3) Run ui-test to confirm Sidebar badge UI works in isolation.");
  }
  if (mode === "multi") {
    console.log("UI expectation: badges on lit lights; done agents → green count.");
    if ((counts?.done ?? 0) === 0 && agentIds.some((id) => agents[id].state === "DONE")) {
      console.log("⚠ Agents marked DONE in map but counts.done=0 — check computeCounts.");
    }
  }
}

async function uiTestRunning(n) {
  const count = Math.max(2, Number(n) || 3);
  const now = Date.now();
  const agents = {};
  for (let i = 1; i <= count; i += 1) {
    const id = `debug-agent-${i}`;
    agents[id] = {
      state: "RUNNING",
      reason: `Debug agent ${i} running`,
      source: "debug-multi-agent-bridge",
      ts: now,
      lastHookTs: now
    };
  }
  const counts = computeCounts(agents);
  const doc = buildMultiDocument(
    {
      sessionId: "debug-agent-1",
      reason: `${count} debug agents running`,
      source: "debug-multi-agent-bridge:ui-test",
      ts: now
    },
    agents,
    counts,
    workspaceMeta()
  );
  await writeBridgeDoc(doc);
  console.log(`Wrote Multi RUNNING x${count} → expect red badge "${count}"`);
  console.log(`File: ${BRIDGE_PATH}`);
}

async function uiTestMixed() {
  const now = Date.now();
  const agents = {
    "debug-agent-1": { state: "RUNNING", reason: "r1", source: "debug", ts: now, lastHookTs: now },
    "debug-agent-2": { state: "RUNNING", reason: "r2", source: "debug", ts: now, lastHookTs: now },
    "debug-agent-3": { state: "DONE", reason: "d1", source: "debug", ts: now, lastHookTs: now, doneAt: now },
    "debug-agent-4": { state: "DONE", reason: "d2", source: "debug", ts: now, lastHookTs: now, doneAt: now }
  };
  const counts = computeCounts(agents);
  const doc = buildMultiDocument(
    {
      sessionId: "debug-agent-1",
      reason: "2 running + 2 done",
      source: "debug-multi-agent-bridge:ui-test",
      ts: now
    },
    agents,
    counts,
    workspaceMeta()
  );
  await writeBridgeDoc(doc);
  console.log("Wrote Multi mixed → expect red badge \"2\" AND green badge \"2\"");
}

async function uiTestError() {
  const now = Date.now();
  const agents = {
    "debug-agent-err": { state: "ERROR", reason: "err", source: "debug", ts: now, lastHookTs: now },
    "debug-agent-r1": { state: "RUNNING", reason: "r1", source: "debug", ts: now, lastHookTs: now },
    "debug-agent-r2": { state: "RUNNING", reason: "r2", source: "debug", ts: now, lastHookTs: now },
    "debug-agent-r3": { state: "RUNNING", reason: "r3", source: "debug", ts: now, lastHookTs: now }
  };
  const counts = computeCounts(agents);
  const doc = buildMultiDocument(
    {
      sessionId: "debug-agent-err",
      reason: "1 error + 3 running",
      source: "debug-multi-agent-bridge:ui-test",
      ts: now
    },
    agents,
    counts,
    workspaceMeta()
  );
  await writeBridgeDoc(doc);
  console.log("Wrote Multi error → expect red BLINK badge \"1\" (error priority, not 3)");
}

async function uiTestSingle() {
  const now = Date.now();
  const doc = buildSingleDocument(
    {
      sessionId: "debug-single",
      state: "RUNNING",
      reason: "Single agent running",
      source: "debug-multi-agent-bridge:ui-test",
      ts: now
    },
    workspaceMeta()
  );
  await writeBridgeDoc(doc);
  console.log("Wrote Single RUNNING → red ON, NO badge");
}

async function removeIfExists(path) {
  if (!existsSync(path)) {
    return false;
  }
  await unlink(path);
  return true;
}

/** Drop stale lock left by a crashed hook process. */
async function clearStaleLock() {
  return removeIfExists(`${BRIDGE_PATH}.lock`);
}

async function resetBridge() {
  await clearStaleLock();
  const now = Date.now();
  const doc = buildSingleDocument(
    {
      sessionId: "cursor-session",
      state: "IDLE",
      reason: "Debug reset",
      source: "debug-multi-agent-bridge",
      ts: now
    },
    workspaceMeta()
  );
  await writeBridgeDoc(doc);
  console.log("Bridge reset to IDLE (single).");
  console.log(`File: ${BRIDGE_PATH}`);
}

/**
 * Wipe debug + hook sidecar cache so real Agent hooks start from a clean slate.
 */
async function clearWorkspaceCache() {
  await clearStaleLock();

  const sidecars = [
    "state.json",
    "active-session.json",
    "session-turn.json",
    "ask-latch.json",
    "watcher-cursor.json",
    "debug-index.json"
  ];

  const removed = [];
  for (const name of sidecars) {
    const path = resolve(STATE_DIR, name);
    if (await removeIfExists(path)) {
      removed.push(name);
    }
  }
  if (await removeIfExists(`${BRIDGE_PATH}.lock`)) {
    removed.push("state.json.lock");
  }

  await mkdir(STATE_DIR, { recursive: true });
  await resetBridge();

  console.log("=== Workspace bridge cache cleared ===");
  console.log(`Dir:  ${STATE_DIR}`);
  if (removed.length) {
    console.log(`Removed: ${removed.join(", ")}`);
  } else {
    console.log("Removed: (nothing extra; state reset to IDLE)");
  }
  console.log("");
  console.log("Next — test real Cursor agents:");
  console.log("  1) npm run install:global-hooks   (if not done recently)");
  console.log("  2) Reload Cursor window");
  console.log("  3) Run 2+ agents in parallel");
  console.log("  4) npm run debug:multi:inspect");
}

async function simulateAdd(id, state) {
  if (!VALID_STATES.has(state)) {
    throw new Error(`Invalid state: ${state}`);
  }
  await clearStaleLock();
  const hookPayload = {
    conversation_id: id,
    transcript_path: `/tmp/debug-transcripts/${id}.jsonl`
  };
  const { wrote, document } = await commitBridgeUpdate({
    bridgePath: BRIDGE_PATH,
    overlayBridgePath: OVERLAY_BRIDGE_PATH,
    mirrorOverlay: MIRROR_OVERLAY,
    workspaceStateId: WORKSPACE_STATE_ID,
    projectRoot: ROOT,
    hookPayload,
    mapped: { state, reason: `simulate ${state}`, source: "debug-multi-agent-bridge:simulate" },
    eventName: "stop",
    forceWrite: true
  });
  console.log(wrote ? "Updated via hook commit path." : "No write (unchanged).");
  if (document) {
    console.log(`mode=${document.displayMode ?? "single"} state=${document.state}`);
    if (document.counts) {
      console.log(`counts=${JSON.stringify(document.counts)}`);
    }
  }
}

async function simulateDone(id) {
  return simulateAdd(id, "DONE");
}

async function simulateEnd(id) {
  const hookPayload = {
    conversation_id: id,
    transcript_path: `/tmp/debug-transcripts/${id}.jsonl`
  };
  const { wrote, document } = await commitBridgeUpdate({
    bridgePath: BRIDGE_PATH,
    overlayBridgePath: OVERLAY_BRIDGE_PATH,
    mirrorOverlay: MIRROR_OVERLAY,
    workspaceStateId: WORKSPACE_STATE_ID,
    projectRoot: ROOT,
    hookPayload,
    mapped: { state: "IDLE", reason: "session ended", source: "debug-multi-agent-bridge:simulate" },
    eventName: "sessionEnd",
    forceWrite: true
  });
  console.log(wrote ? "sessionEnd applied." : "No write.");
  if (document) {
    diagnose(document);
  }
}

async function runSequence(delayMs) {
  await uiTestRunning(3);
  console.log(`\nWaiting ${delayMs}ms…`);
  await new Promise((r) => setTimeout(r, delayMs));
  await uiTestMixed();
  console.log(`\nWaiting ${delayMs}ms…`);
  await new Promise((r) => setTimeout(r, delayMs));
  await uiTestSingle();
  console.log("\nSequence done.");
}

function watchBridge() {
  console.log(`Watching ${BRIDGE_PATH} (Ctrl+C to stop)\n`);
  const refresh = async () => {
    const doc = await readBridge();
    console.log(`--- ${new Date().toISOString()} ---`);
    diagnose(doc);
    console.log("");
  };
  fsWatch(BRIDGE_PATH, { persistent: true }, () => {
    void refresh();
  });
  void refresh();
}

async function run() {
  await ensurePaths();
  const [cmd, ...rest] = process.argv.slice(2);

  if (!cmd || cmd === "help") {
    printHelp();
    return;
  }

  if (cmd === "inspect") {
    diagnose(await readBridge());
    return;
  }

  if (cmd === "watch") {
    watchBridge();
    return;
  }

  if (cmd === "reset") {
    await resetBridge();
    return;
  }

  if (cmd === "clear") {
    await clearWorkspaceCache();
    return;
  }

  if (cmd === "ui-test") {
    const sub = rest[0] || "running";
    if (sub === "running") {
      await uiTestRunning(rest[1]);
      return;
    }
    if (sub === "mixed") {
      await uiTestMixed();
      return;
    }
    if (sub === "error") {
      await uiTestError();
      return;
    }
    if (sub === "single") {
      await uiTestSingle();
      return;
    }
    throw new Error(`Unknown ui-test scenario: ${sub}`);
  }

  if (cmd === "simulate") {
    const [action, id, state] = rest;
    if (action === "add") {
      if (!id || !state) {
        throw new Error("Usage: simulate add <id> <STATE>");
      }
      await simulateAdd(id, state.toUpperCase());
      return;
    }
    if (action === "done") {
      if (!id) {
        throw new Error("Usage: simulate done <id>");
      }
      await simulateDone(id);
      return;
    }
    if (action === "end") {
      if (!id) {
        throw new Error("Usage: simulate end <id>");
      }
      await simulateEnd(id);
      return;
    }
    throw new Error(`Unknown simulate action: ${action}`);
  }

  if (cmd === "sequence") {
    const delayMs = Number(rest[0] || 2000);
    await runSequence(delayMs);
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
