import test from "node:test";
import assert from "node:assert/strict";
import {
  computeCounts,
  pruneAgents,
  updateAgents,
  aggregateTopLevelState,
  countsEqual,
  shouldWriteBridgeDocument,
  T_DONE,
  isAgentActive,
  hydrateAgentsFromDocument,
  agentIdFrom,
  normalizeAgentsMap,
  resolveDisplayDecision,
  isSoloNewAgentWave
} from "../lib/multi-agent-bridge.mjs";

test("computeCounts merges plan into running", () => {
  const counts = computeCounts({
    a: { state: "RUNNING" },
    b: { state: "WAITING_PLAN_BUILD" }
  });
  assert.equal(counts.running, 2);
  assert.equal(counts.plan, 0);
});

test("pruneAgents removes stale DONE after T_done", () => {
  const now = Date.now();
  const agents = pruneAgents(
    {
      old: {
        state: "DONE",
        lastHookTs: now - 1000,
        doneAt: now - T_DONE - 1000
      },
      fresh: {
        state: "RUNNING",
        lastHookTs: now
      }
    },
    now
  );
  assert.deepEqual(Object.keys(agents), ["fresh"]);
});

test("updateAgents removes agent on sessionEnd", () => {
  const now = Date.now();
  const agents = updateAgents(
    {
      a: { state: "RUNNING", lastHookTs: now }
    },
    "a",
    { state: "IDLE", reason: "ended" },
    now,
    "sessionEnd"
  );
  assert.deepEqual(agents, {});
});

test("aggregateTopLevelState prioritizes waiting over error", () => {
  assert.equal(
    aggregateTopLevelState({ running: 2, waiting: 1, done: 0, error: 1 }),
    "WAITING_USER"
  );
});

test("shouldWriteBridgeDocument skips unchanged multi counts", () => {
  const prev = {
    displayMode: "multi",
    state: "RUNNING",
    counts: { running: 2, waiting: 0, done: 0, error: 0, plan: 0 }
  };
  const next = {
    displayMode: "multi",
    state: "RUNNING",
    counts: { running: 2, waiting: 0, done: 0, error: 0, plan: 0 }
  };
  assert.equal(countsEqual(prev.counts, next.counts), true);
  assert.equal(shouldWriteBridgeDocument(prev, next), false);
});

test("hydrateAgentsFromDocument seeds single v1 agent for multi transition", () => {
  const now = Date.now();
  const agents = hydrateAgentsFromDocument(
    {
      tool: "cursor",
      sessionId: "conv-a",
      state: "RUNNING",
      ts: now
    },
    now
  );
  assert.equal(Object.keys(agents).length, 1);
  assert.equal(agents["conv-a"].state, "RUNNING");
});

test("agentIdFrom ignores transcript_path to avoid duplicate ids", () => {
  assert.equal(agentIdFrom({ conversation_id: "c1" }), "c1");
  assert.equal(
    agentIdFrom({ conversation_id: "c1", transcript_path: "/tmp/a.jsonl" }),
    "c1"
  );
});

test("updateAgents collapses legacy transcript alias duplicates", () => {
  const now = Date.now();
  const conv = "conv-1";
  const txKey = `${conv}::tx:/tmp/t.jsonl`;
  let agents = {
    [conv]: { state: "RUNNING", lastHookTs: now - 1000 },
    [txKey]: { state: "RUNNING", lastHookTs: now - 500 }
  };
  agents = updateAgents(agents, conv, { state: "DONE", reason: "done" }, now, "stop");
  assert.equal(Object.keys(agents).length, 1);
  assert.equal(agents[conv].state, "DONE");
});

test("normalizeAgentsMap merges alias groups to one canonical id", () => {
  const now = Date.now();
  const merged = normalizeAgentsMap({
    "conv-1": { state: "RUNNING", lastHookTs: now - 100 },
    "conv-1::tx:/tmp/a.jsonl": { state: "DONE", lastHookTs: now }
  });
  assert.equal(Object.keys(merged).length, 1);
  assert.equal(merged["conv-1"].state, "DONE");
});

test("resolveDisplayDecision keeps multi when four agents are done only", () => {
  const now = Date.now();
  const agents = {
    a: { state: "DONE", lastHookTs: now, doneAt: now },
    b: { state: "DONE", lastHookTs: now, doneAt: now },
    c: { state: "DONE", lastHookTs: now, doneAt: now },
    d: { state: "DONE", lastHookTs: now, doneAt: now }
  };
  assert.equal(resolveDisplayDecision(agents).mode, "multi");
});

test("resolveDisplayDecision single when new solo agent starts after done wave", () => {
  const doneAt = 1000;
  const runningSince = 5000;
  const agents = {
    a: { state: "DONE", lastHookTs: doneAt, doneAt },
    b: { state: "DONE", lastHookTs: doneAt, doneAt },
    c: { state: "DONE", lastHookTs: doneAt, doneAt },
    d: { state: "DONE", lastHookTs: doneAt, doneAt },
    new: { state: "RUNNING", lastHookTs: runningSince, runningSince, ts: runningSince }
  };
  const decision = resolveDisplayDecision(agents);
  assert.equal(decision.mode, "single");
  assert.equal(Object.keys(decision.agents).length, 1);
  assert.equal(decision.agents.new.state, "RUNNING");
});

test("resolveDisplayDecision multi when one running and one done overlap in time", () => {
  const agents = {
    slow: { state: "RUNNING", lastHookTs: 1000, runningSince: 1000, ts: 1000 },
    fast: { state: "DONE", lastHookTs: 2000, doneAt: 2000 }
  };
  assert.equal(isSoloNewAgentWave(agents), false);
  assert.equal(resolveDisplayDecision(agents).mode, "multi");
});
