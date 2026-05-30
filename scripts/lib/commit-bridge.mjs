import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { withBridgeLock } from "./bridge-lock.mjs";
import {
  buildMultiDocument,
  buildSingleDocument,
  computeCounts,
  agentIdFrom,
  conversationIdFrom,
  hydrateAgentsFromDocument,
  normalizeAgentsMap,
  pruneAgents,
  resolveDisplayDecision,
  shouldWriteBridgeDocument,
  updateAgents
} from "./multi-agent-bridge.mjs";

const DEBUG = process.env.TRAFFIC_LIGHTS_DEBUG === "1";

function debugMulti(eventName, agentId, agents, counts, mapped, displayMode) {
  if (!DEBUG) {
    return;
  }
  const ids = Object.entries(agents || {})
    .map(([id, agent]) => `${id.slice(-10)}:${agent.state}`)
    .join(" ");
  process.stderr.write(
    `[bridge:multi] ${eventName} mode=${displayMode || "?"} agent=${String(agentId || "?").slice(-16)} mapped=${mapped?.state} n=${Object.keys(agents || {}).length} counts=${JSON.stringify(counts)} [${ids}]\n`
  );
}

async function readBridgeDocument(bridgePath) {
  try {
    const raw = await readFile(bridgePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeBridgeFiles(bridgePath, overlayBridgePath, mirrorOverlay, document) {
  const body = JSON.stringify(document, null, 2);
  await mkdir(dirname(bridgePath), { recursive: true });
  await writeFile(bridgePath, body, "utf8");
  if (mirrorOverlay) {
    await mkdir(dirname(overlayBridgePath), { recursive: true });
    await writeFile(overlayBridgePath, body, "utf8");
  }
}

/**
 * @param {{
 *   bridgePath: string,
 *   overlayBridgePath: string,
 *   mirrorOverlay: boolean,
 *   workspaceStateId: string,
 *   projectRoot: string,
 *   hookPayload: Record<string, unknown>,
 *   mapped: { state: string, reason?: string, source?: string },
 *   eventName: string,
 *   forceWrite?: boolean,
 *   allowSingleWrite?: boolean
 * }} options
 * @returns {Promise<{ wrote: boolean, document?: Record<string, unknown> }>}
 */
export async function commitBridgeUpdate(options) {
  const {
    bridgePath,
    overlayBridgePath,
    mirrorOverlay,
    workspaceStateId,
    projectRoot,
    hookPayload,
    mapped,
    eventName,
    forceWrite = false,
    allowSingleWrite = true
  } = options;

  const conversationId = conversationIdFrom(hookPayload);
  const agentId = agentIdFrom(hookPayload);
  const sessionId = conversationId || "cursor-session";
  const now = Date.now();
  const workspaceMeta = { workspaceStateId, workspaceRoot: projectRoot };
  const base = {
    sessionId,
    state: mapped.state,
    reason: mapped.reason,
    source: mapped.source,
    ts: now
  };

  return withBridgeLock(bridgePath, async () => {
    const previous = await readBridgeDocument(bridgePath);

    if (!conversationId || !agentId) {
      const document = buildSingleDocument(base, workspaceMeta);
      if (!allowSingleWrite && !forceWrite) {
        return { wrote: false };
      }
      if (!forceWrite && !shouldWriteBridgeDocument(previous, document)) {
        return { wrote: false };
      }
      await writeBridgeFiles(bridgePath, overlayBridgePath, mirrorOverlay, document);
      return { wrote: true, document };
    }

    let agents = hydrateAgentsFromDocument(previous, now);
    agents = normalizeAgentsMap(agents);
    agents = updateAgents(agents, agentId, mapped, now, eventName);
    agents = normalizeAgentsMap(agents);
    agents = pruneAgents(agents, now);
    const { mode: displayMode, agents: displayAgents } = resolveDisplayDecision(agents);
    agents = displayAgents;
    const activeIds = Object.keys(agents);
    const countsPreview = displayMode === "multi" ? computeCounts(agents) : null;
    debugMulti(eventName, agentId, agents, countsPreview ?? computeCounts(agents), mapped, displayMode);

    if (displayMode === "single" || activeIds.length <= 1) {
      const sole = activeIds.length === 1 ? agents[activeIds[0]] : null;
      const singleBase = {
        sessionId,
        state: sole?.state ?? mapped.state,
        reason: sole?.reason ?? mapped.reason,
        source: sole?.source ?? mapped.source,
        ts: now
      };
      const document = buildSingleDocument(singleBase, workspaceMeta);
      if (!allowSingleWrite && !forceWrite) {
        return { wrote: false };
      }
      if (!forceWrite && !shouldWriteBridgeDocument(previous, document)) {
        return { wrote: false };
      }
      await writeBridgeFiles(bridgePath, overlayBridgePath, mirrorOverlay, document);
      return { wrote: true, document };
    }

    const counts = computeCounts(agents);
    debugMulti(`${eventName}:write`, agentId, agents, counts, mapped, "multi");
    const document = buildMultiDocument(base, agents, counts, workspaceMeta);
    if (!forceWrite && !shouldWriteBridgeDocument(previous, document)) {
      return { wrote: false };
    }
    await writeBridgeFiles(bridgePath, overlayBridgePath, mirrorOverlay, document);
    return { wrote: true, document };
  });
}
