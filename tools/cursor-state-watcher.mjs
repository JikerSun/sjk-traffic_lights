#!/usr/bin/env node

import { watch, existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import {
  readTranscriptRows,
  getAskQuestionPhase,
  readSessionTurn,
  clearAskLatch,
  isAskQuestionUnresolved
} from "../scripts/lib/cursor-transcript-state.mjs";
import { normalizePlanContext } from "../scripts/lib/plan-session.mjs";
import { resolveBridgeState } from "../scripts/lib/bridge-resolve.mjs";
import {
  resolveBridgePath,
  resolveActiveSessionPath,
  resolveOverlayBridgePath,
  shouldMirrorOverlayBridge
} from "../scripts/lib/bridge-paths.mjs";

const root = process.cwd();
const activeSessionPath = resolveActiveSessionPath(root);
const bridgePath = resolveBridgePath(root);
const overlayBridgePath = resolveOverlayBridgePath(root);
const mirrorOverlay = shouldMirrorOverlayBridge(root);

const once = process.argv.includes("--once");
const verbose = process.argv.includes("--verbose");
const noWatch = process.argv.includes("--no-watch");
const WATCHER_VERSION = "v4.7";

const POLL_IDLE_MS = 2000;
const POLL_ACTIVE_MS = 500;
const WATCH_DEBOUNCE_MS = 120;

let debounceTimer = null;
let transcriptWatcher = null;
let activeSessionWatcher = null;
let watchedTranscriptPath = null;
let tickInFlight = false;
let tickQueued = false;
let lastWritten = { state: "", ts: 0 };
let pollTimer = null;
let sessionActive = false;

async function readActiveSession() {
  try {
    const raw = await readFile(activeSessionPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readCurrentBridgeState() {
  try {
    const raw = await readFile(bridgePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { state: "IDLE" };
  }
}

async function writeBridgeState(state, reason, source, sessionId) {
  const now = Date.now();
  if (lastWritten.state === state && now - lastWritten.ts < 400) {
    return;
  }
  lastWritten = { state, ts: now };

  const payload = {
    tool: "cursor",
    sessionId: sessionId || "watcher",
    state,
    reason: `${WATCHER_VERSION}: ${reason}`,
    source,
    ts: now
  };
  const body = JSON.stringify(payload, null, 2);
  await mkdir(dirname(bridgePath), { recursive: true });
  await writeFile(bridgePath, body, "utf8");
  if (mirrorOverlay) {
    await mkdir(dirname(overlayBridgePath), { recursive: true });
    await writeFile(overlayBridgePath, body, "utf8");
  }

  if (verbose) {
    process.stdout.write(`[watcher] -> ${state}\n`);
  }
}

async function tick() {
  if (tickInFlight) {
    tickQueued = true;
    return;
  }
  tickInFlight = true;
  try {
    const active = await readActiveSession();
    const transcriptPath = active?.transcriptPath;
    if (!transcriptPath) {
      return;
    }

    const sessionTurn = await readSessionTurn(root);
    sessionActive = Boolean(sessionTurn?.active);
    const plan = normalizePlanContext(sessionTurn?.plan);
    const rows = await readTranscriptRows(transcriptPath);
    const bridge = await readCurrentBridgeState();
    const current = bridge?.state || "IDLE";

    if (current === "DONE" || current === "ERROR") {
      return;
    }

    const phase = getAskQuestionPhase(rows);
    const mapped = resolveBridgeState({
      eventName: "watcher",
      rows,
      sessionTurn,
      plan,
      phase
    });

    if (sessionTurn?.askPending && current !== "WAITING_USER" && phase !== "agent_replying" && phase !== "new_turn") {
      await writeBridgeState("WAITING_USER", "Ask pending (session)", "cursor-watcher", active.conversationId);
      return;
    }

    if (!mapped) {
      if (current === "WAITING_USER" && (phase === "agent_replying" || !sessionTurn?.askPending)) {
        await clearAskLatch(root);
        await writeBridgeState("RUNNING", "Agent working", "cursor-watcher", active.conversationId);
      }
      return;
    }

    if (mapped.state !== "WAITING_USER") {
      await clearAskLatch(root);
    }

    if (mapped.state !== current) {
      await writeBridgeState(mapped.state, mapped.reason, mapped.source, active.conversationId);
    }
  } finally {
    tickInFlight = false;
    if (tickQueued) {
      tickQueued = false;
      void tick();
    }
  }
}

function scheduleTick() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void tick();
  }, WATCH_DEBOUNCE_MS);
}

function bindTranscriptWatch(transcriptPath) {
  if (!transcriptPath || transcriptPath === watchedTranscriptPath) {
    return;
  }
  if (transcriptWatcher) {
    transcriptWatcher.close();
    transcriptWatcher = null;
  }
  watchedTranscriptPath = transcriptPath;
  if (!existsSync(transcriptPath)) {
    return;
  }
  try {
    transcriptWatcher = watch(transcriptPath, () => scheduleTick());
  } catch {
    // ignore
  }
}

async function refreshTranscriptWatch() {
  const active = await readActiveSession();
  bindTranscriptWatch(active?.transcriptPath || null);
}

function bindActiveSessionWatch() {
  if (!existsSync(activeSessionPath)) {
    return;
  }
  try {
    activeSessionWatcher = watch(activeSessionPath, () => {
      void refreshTranscriptWatch();
      scheduleTick();
    });
  } catch {
    // ignore
  }
}

function resetPollTimer() {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  const ms = sessionActive ? POLL_ACTIVE_MS : POLL_IDLE_MS;
  pollTimer = setInterval(() => void tick(), ms);
}

async function main() {
  if (once) {
    await tick();
    return;
  }

  if (verbose) {
    process.stdout.write(`[watcher] ${WATCHER_VERSION} poll=${POLL_ACTIVE_MS}/${POLL_IDLE_MS}ms\n`);
  }

  await tick();

  if (!noWatch) {
    bindActiveSessionWatch();
    await refreshTranscriptWatch();
    resetPollTimer();
    setInterval(() => {
      const nextActive = sessionActive;
      void readSessionTurn(root).then((t) => {
        const nowActive = Boolean(t?.active);
        if (nowActive !== nextActive) {
          sessionActive = nowActive;
          resetPollTimer();
        }
      });
    }, 3000);
  }
}

main().catch((error) => {
  console.error(`[watcher] ${error.message}`);
  process.exitCode = 1;
});
