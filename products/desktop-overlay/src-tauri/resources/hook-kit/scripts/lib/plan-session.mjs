#!/usr/bin/env node

import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** @typedef {{ awaitingBuild: boolean, buildStarted: boolean, touched: boolean, lastPlanFile?: string|null }} PlanContext */

export const EMPTY_PLAN_CONTEXT = Object.freeze({
  awaitingBuild: false,
  buildStarted: false,
  touched: false,
  lastPlanFile: null
});

export function normalizePlanContext(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_PLAN_CONTEXT };
  }
  return {
    awaitingBuild: Boolean(raw.awaitingBuild),
    buildStarted: Boolean(raw.buildStarted),
    touched: Boolean(raw.touched),
    lastPlanFile: raw.lastPlanFile || null
  };
}

/** Paths that indicate a Cursor plan artifact (not generic markdown). */
export function isPlanArtifactPath(filePath) {
  const p = String(filePath || "");
  if (!p) {
    return false;
  }
  return /\.plan\.md$/i.test(p) || /[\\/]\.cursor[\\/]plans[\\/]/i.test(p);
}

export function isCreatePlanTool(toolName) {
  const n = String(toolName || "").toLowerCase().replace(/[_\s-]/g, "");
  return n === "createplan";
}

const EXEC_TOOL_NAMES = new Set([
  "shell",
  "delete",
  "applypatch",
  "editnotebook",
  "notebookedit",
  "runterminalcmd",
  "task",
  "grep",
  "glob",
  "read",
  "webfetch",
  "websearch"
]);

function toolTargetPath(toolInput) {
  const ti = toolInput || {};
  return ti.path || ti.file_path || ti.filePath || ti.target_file || "";
}

export function isPlanFileWrite(toolName, toolInput) {
  const name = String(toolName || "");
  if (name !== "Write" && name !== "StrReplace" && name !== "ApplyPatch") {
    return false;
  }
  return isPlanArtifactPath(toolTargetPath(toolInput));
}

/** Non-plan writes / shell etc. imply user started Build execution. */
export function marksPlanBuildStarted(toolName, toolInput) {
  const name = String(toolName || "");
  if (isCreatePlanTool(name)) {
    return false;
  }
  if (isPlanFileWrite(name, toolInput)) {
    return false;
  }
  const lower = name.toLowerCase();
  if (EXEC_TOOL_NAMES.has(lower)) {
    return true;
  }
  if (lower === "write" || lower === "strreplace") {
    const p = toolTargetPath(toolInput);
    return Boolean(p) && !isPlanArtifactPath(p);
  }
  return false;
}

/**
 * Heuristic: agent text suggests plan is ready but Build not clicked yet.
 * Wording differs from cursor-light-desktop; tuned for Chamet/Cursor phrasing.
 */
export function agentTextImpliesPlanAwaitingBuild(text) {
  const t = String(text || "");
  if (t.length < 24) {
    return false;
  }
  if (/已全部完成|all\s+(?:tasks?\s+)?complete|implementation\s+finished|无需\s*Build/i.test(t)) {
    return false;
  }
  if (/验收|acceptance\s+test|对照表|测完请回我/i.test(t)) {
    return false;
  }

  const citesPlan = /\.plan\.md|\.cursor\/plans\/|计划文件|plan\s+file/i.test(t);
  const buildCue =
    /(?:点击|点|press)\s*Build|Build\s*(?:即可|to\s+(?:start|implement))|Review\s+Plan|执行计划|开始实施|implement\s+the\s+plan/i.test(
      t
    );
  const reviewCue = /review\s+the\s+plan|确认(?:该)?方案|认可(?:该)?计划/i.test(t);

  if (buildCue && (citesPlan || reviewCue)) {
    return true;
  }
  if (citesPlan && /回复.*执行|continue\s+when\s+ready/i.test(t)) {
    return true;
  }
  return false;
}

export function shouldStayPlanAwaiting(plan) {
  return Boolean(plan?.awaitingBuild) && !plan?.buildStarted;
}

const PLAN_SCAN_WINDOW_MS = 8 * 60 * 1000;

/** Optional filesystem hint: recent plan under ~/.cursor/plans */
export async function findRecentPlanArtifact(turnStartedMs = 0) {
  const plansDir = join(homedir(), ".cursor", "plans");
  const now = Date.now();
  let bestMs = 0;
  let bestName = "";

  let entries;
  try {
    entries = await readdir(plansDir);
  } catch {
    return null;
  }

  for (const name of entries) {
    if (!name.endsWith(".plan.md")) {
      continue;
    }
    try {
      const st = await stat(join(plansDir, name));
      const mtime = st.mtimeMs;
      if (now - mtime > PLAN_SCAN_WINDOW_MS) {
        continue;
      }
      if (turnStartedMs && mtime < turnStartedMs - 3000) {
        continue;
      }
      if (mtime > bestMs) {
        bestMs = mtime;
        bestName = name;
      }
    } catch {
      // skip
    }
  }

  return bestName || null;
}

export function mergePlanContext(plan, patch) {
  return normalizePlanContext({ ...plan, ...patch });
}
