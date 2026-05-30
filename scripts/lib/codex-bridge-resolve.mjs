#!/usr/bin/env node

/** @typedef {"IDLE"|"RUNNING"|"WAITING_USER"|"WAITING_PLAN_BUILD"|"DONE"|"ERROR"} BridgeState */

/**
 * Map Codex hook_event_name + payload → bridge state.
 * Preliminary mapping — refine after recon logs (see docs/codex-adapter.md §3).
 *
 * @param {{ eventName: string, payload?: Record<string, unknown> }} input
 * @returns {{ state: BridgeState, reason?: string, source?: string } | null}
 */
export function resolveCodexBridgeState({ eventName, payload = {} }) {
  const source = `codex-hook:${eventName}`;
  const permissionMode = String(payload.permission_mode || "");

  if (eventName === "SessionStart") {
    const src = String(payload.source || "");
    if (src === "clear") {
      return { state: "IDLE", reason: "Session cleared", source };
    }
    return null;
  }

  if (eventName === "UserPromptSubmit") {
    return {
      state: "RUNNING",
      reason: payload.prompt ? `Prompt: ${String(payload.prompt).slice(0, 60)}` : "User prompt",
      source
    };
  }

  if (eventName === "PreToolUse" || eventName === "PostToolUse") {
    const toolName = payload.tool_name ? String(payload.tool_name) : "tool";
    const failed = inferToolFailure(payload);
    if (failed) {
      return { state: "ERROR", reason: failed, source };
    }
    return { state: "RUNNING", reason: `Tool: ${toolName}`, source };
  }

  if (eventName === "PermissionRequest") {
    const toolName = payload.tool_name ? String(payload.tool_name) : "approval";
    return {
      state: "WAITING_USER",
      reason: `Approval: ${toolName}`,
      source
    };
  }

  if (eventName === "SubagentStart") {
    const agentType = payload.agent_type ? String(payload.agent_type) : "subagent";
    return { state: "RUNNING", reason: `Subagent: ${agentType}`, source };
  }

  if (eventName === "SubagentStop") {
    return { state: "DONE", reason: "Subagent finished", source };
  }

  if (eventName === "Stop") {
    if (permissionMode === "plan") {
      return null;
    }
    return { state: "DONE", reason: "Turn finished", source };
  }

  return null;
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {string | null}
 */
function inferToolFailure(payload) {
  const response = payload.tool_response;
  if (response && typeof response === "object") {
    const obj = /** @type {Record<string, unknown>} */ (response);
    if (obj.success === false || obj.ok === false) {
      return String(obj.error || obj.message || "Tool failed");
    }
    if (typeof obj.exit_code === "number" && obj.exit_code !== 0) {
      return `Exit code ${obj.exit_code}`;
    }
  }
  if (typeof response === "string" && /error|failed/i.test(response)) {
    return response.slice(0, 120);
  }
  return null;
}
