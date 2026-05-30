/** @typedef {import('../../libs/protocol/dist/index.js').AiState} AiState */

export const T_DONE = 10 * 60 * 1000;
export const T_STALE = 24 * 60 * 60 * 1000;
export const MAX_ACTIVE = 20;

/**
 * @param {Record<string, unknown>} payload
 * @returns {string | null}
 */
export function conversationIdFrom(payload) {
  return payload?.conversation_id || payload?.session_id || null;
}

/**
 * Stable per-agent key. Uses conversation_id; only adds `::` suffix for explicit
 * subagent/task ids from Cursor. Do NOT suffix transcript_path — it arrives late
 * and creates duplicate map entries (e.g. conv + conv::tx:… → double RUNNING count).
 *
 * @param {Record<string, unknown>} payload
 * @returns {string | null}
 */
export function agentIdFrom(payload) {
  const conversationId = conversationIdFrom(payload);
  if (!conversationId) {
    return null;
  }

  const explicit =
    payload?.subagent_id ||
    payload?.subagentId ||
    payload?.agent_run_id ||
    payload?.agentRunId ||
    payload?.background_agent_id ||
    payload?.task_id ||
    payload?.taskId ||
    null;
  if (explicit) {
    return `${conversationId}::${explicit}`;
  }

  return conversationId;
}

/** Group key for collapsing transcript_path alias duplicates under one conversation. */
export function aliasGroupKey(agentId) {
  const id = String(agentId);
  const txMarker = "::tx:";
  if (id.includes(txMarker)) {
    return id.slice(0, id.indexOf(txMarker));
  }
  return id;
}

/**
 * @param {Record<string, { state?: AiState, lastHookTs?: number, doneAt?: number, ts?: number }>} agents
 */
export function mergeAgentRecords(records) {
  const stateRank = {
    ERROR: 6,
    WAITING_USER: 5,
    RUNNING: 4,
    WAITING_PLAN_BUILD: 3,
    DONE: 2,
    IDLE: 1
  };
  return records.reduce((best, agent) => {
    if (!best) {
      return { ...agent };
    }
    const bestTs = best.lastHookTs ?? best.ts ?? 0;
    const agentTs = agent.lastHookTs ?? agent.ts ?? 0;
    if (agentTs > bestTs) {
      return { ...agent };
    }
    if (agentTs < bestTs) {
      return best;
    }
    const bestRank = stateRank[best.state] ?? 0;
    const agentRank = stateRank[agent.state] ?? 0;
    return agentRank > bestRank ? { ...agent } : best;
  }, null);
}

/**
 * Merge duplicate ids for the same logical agent (legacy conv::tx: aliases).
 *
 * @param {Record<string, unknown>} agents
 */
export function normalizeAgentsMap(agents) {
  const groups = new Map();
  for (const [id, agent] of Object.entries(agents || {})) {
    const group = aliasGroupKey(id);
    const bucket = groups.get(group) || [];
    bucket.push({ id, agent });
    groups.set(group, bucket);
  }

  const next = {};
  for (const [group, entries] of groups) {
    next[group] = mergeAgentRecords(entries.map((entry) => entry.agent));
  }
  return next;
}

/**
 * @param {Record<string, unknown>} agents
 * @param {string} agentId
 */
export function collapseConversationAliases(agents, agentId) {
  const canonical = aliasGroupKey(agentId);
  const next = { ...(agents || {}) };
  for (const key of Object.keys(next)) {
    if (key !== canonical && aliasGroupKey(key) === canonical) {
      delete next[key];
    }
  }
  return next;
}

/**
 * @param {{ state: AiState, lastHookTs: number, doneAt?: number }} agent
 * @param {number} now
 */
export function isAgentActive(agent, now) {
  if (!agent?.state || !agent?.lastHookTs) {
    return false;
  }
  if (now - agent.lastHookTs > T_STALE) {
    return false;
  }
  if (agent.state === "IDLE") {
    return false;
  }
  if (agent.state === "DONE") {
    const doneAt = agent.doneAt ?? agent.lastHookTs;
    if (now - doneAt > T_DONE) {
      return false;
    }
  }
  return true;
}

/**
 * @param {Record<string, { state: AiState, lastHookTs: number, doneAt?: number }>} agents
 * @param {number} now
 */
export function pruneAgents(agents, now) {
  let entries = Object.entries(agents || {}).filter(([, agent]) => isAgentActive(agent, now));
  if (entries.length > MAX_ACTIVE) {
    entries.sort((a, b) => b[1].lastHookTs - a[1].lastHookTs);
    entries = entries.slice(0, MAX_ACTIVE);
  }
  return Object.fromEntries(entries);
}

/**
 * @param {Record<string, { state: AiState }>} agents
 */
export function computeCounts(agents) {
  let running = 0;
  let waiting = 0;
  let done = 0;
  let error = 0;
  let plan = 0;

  for (const agent of Object.values(agents || {})) {
    switch (agent.state) {
      case "RUNNING":
        running += 1;
        break;
      case "WAITING_USER":
        waiting += 1;
        break;
      case "DONE":
        done += 1;
        break;
      case "ERROR":
        error += 1;
        break;
      case "WAITING_PLAN_BUILD":
        plan += 1;
        break;
      default:
        break;
    }
  }

  running += plan;
  return { running, waiting, done, error, plan: 0 };
}

/**
 * @param {{ running: number, waiting: number, done: number, error: number }} counts
 * @returns {AiState}
 */
export function aggregateTopLevelState(counts) {
  if (counts.waiting > 0) {
    return "WAITING_USER";
  }
  if (counts.error > 0) {
    return "ERROR";
  }
  if (counts.running > 0) {
    return "RUNNING";
  }
  if (counts.done > 0) {
    return "DONE";
  }
  return "IDLE";
}

/**
 * @param {Record<string, unknown>} agents
 * @param {string} agentId
 * @param {{ state: AiState, reason?: string, source?: string }} mapped
 * @param {number} now
 * @param {string} eventName
 */
export function updateAgents(agents, agentId, mapped, now, eventName) {
  const canonicalId = aliasGroupKey(agentId);
  let next = { ...(agents || {}) };

  if (eventName === "sessionEnd" || mapped.state === "IDLE") {
    for (const key of Object.keys(next)) {
      if (aliasGroupKey(key) === canonicalId) {
        delete next[key];
      }
    }
    return next;
  }

  next = collapseConversationAliases(next, canonicalId);

  const prev = next[canonicalId];
  const agent = {
    state: mapped.state,
    reason: mapped.reason,
    source: mapped.source,
    ts: now,
    lastHookTs: now
  };
  if (mapped.state === "DONE") {
    agent.doneAt = prev?.state === "DONE" ? prev.doneAt ?? now : now;
  }
  next[canonicalId] = agent;
  return next;
}

/**
 * @param {Record<string, unknown> | null | undefined} doc
 */
export function readAgentsMap(doc) {
  if (doc?.bridgeVersion === 2 && doc.agents && typeof doc.agents === "object") {
    return { ...doc.agents };
  }
  return {};
}

/**
 * @param {Record<string, unknown> | null | undefined} doc
 * @param {number} [now=Date.now()]
 */
export function hydrateAgentsFromDocument(doc, now = Date.now()) {
  const fromV2 = readAgentsMap(doc);
  if (Object.keys(fromV2).length > 0) {
    return fromV2;
  }

  const agents = {};
  const sessionId = doc?.sessionId || doc?.session_id;
  const state = doc?.state;
  if (
    typeof sessionId === "string" &&
    sessionId &&
    sessionId !== "cursor-session" &&
    typeof state === "string" &&
    state !== "IDLE"
  ) {
    agents[sessionId] = {
      state,
      reason: doc?.reason,
      source: doc?.source,
      ts: doc?.ts || now,
      lastHookTs: doc?.ts || now,
      doneAt: state === "DONE" ? doc?.ts || now : undefined
    };
  }
  return agents;
}

/**
 * @param {{ running: number, waiting: number, done: number, error: number, plan: number } | undefined} a
 * @param {{ running: number, waiting: number, done: number, error: number, plan: number } | undefined} b
 */
export function countsEqual(a, b) {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.running === b.running &&
    a.waiting === b.waiting &&
    a.done === b.done &&
    a.error === b.error &&
    a.plan === b.plan
  );
}

/**
 * @param {Record<string, unknown>} base
 * @param {{ workspaceStateId?: string, workspaceRoot?: string }} workspaceMeta
 */
export function buildSingleDocument(base, workspaceMeta) {
  return {
    tool: "cursor",
    sessionId: base.sessionId,
    state: base.state,
    reason: base.reason,
    source: base.source,
    ts: base.ts,
    ...workspaceMeta
  };
}

/**
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} agents
 * @param {{ running: number, waiting: number, done: number, error: number, plan: number }} counts
 * @param {{ workspaceStateId?: string, workspaceRoot?: string }} workspaceMeta
 */
export function buildMultiDocument(base, agents, counts, workspaceMeta) {
  return {
    tool: "cursor",
    sessionId: base.sessionId,
    state: aggregateTopLevelState(counts),
    reason: base.reason,
    source: base.source,
    ts: base.ts,
    ...workspaceMeta,
    bridgeVersion: 2,
    displayMode: "multi",
    counts,
    agents
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} previous
 * @param {Record<string, unknown>} next
 */
export function shouldWriteBridgeDocument(previous, next) {
  const prevMode = previous?.displayMode === "multi" ? "multi" : "single";
  const nextMode = next.displayMode === "multi" ? "multi" : "single";
  if (prevMode !== nextMode) {
    return true;
  }
  if (nextMode === "multi") {
    return !countsEqual(previous?.counts, next.counts) || previous?.state !== next.state;
  }
  return previous?.state !== next.state;
}
