#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "ai-traffic-lights-codex";
const CODEX_HOOK_EVENTS = [
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PermissionRequest",
  "SubagentStart",
  "SubagentStop",
  "Stop",
  "SessionStart"
];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CODEX_HOME = resolve(homedir(), ".codex");
const GLOBAL_ROOT = resolve(CODEX_HOME, "ai-traffic-lights");
const USER_HOOKS_JSON = resolve(CODEX_HOME, "hooks.json");
const MANIFEST_PATH = resolve(GLOBAL_ROOT, "install-manifest.json");

function getKitRoot() {
  return process.env.AI_TL_KIT_ROOT ? resolve(process.env.AI_TL_KIT_ROOT) : ROOT;
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function isOurHookHandler(handler) {
  if (!handler || handler.type !== "command") {
    return false;
  }
  const cmd = String(handler.command || "");
  return cmd.includes("ai-traffic-lights") && cmd.includes("write-bridge-from-codex-hook");
}

function isOurHookGroup(group) {
  const hooks = group?.hooks;
  if (!Array.isArray(hooks)) {
    return false;
  }
  return hooks.some(isOurHookHandler);
}

function stripOurHooks(hooksDoc) {
  if (!hooksDoc?.hooks || typeof hooksDoc.hooks !== "object") {
    return hooksDoc;
  }
  const nextHooks = {};
  for (const [eventName, groups] of Object.entries(hooksDoc.hooks)) {
    const kept = (Array.isArray(groups) ? groups : []).filter((group) => !isOurHookGroup(group));
    if (kept.length) {
      nextHooks[eventName] = kept;
    }
  }
  return { ...hooksDoc, hooks: nextHooks };
}

function buildHookGroups(nodePath, hookScriptPath) {
  const handler = {
    type: "command",
    command: `${nodePath} ${hookScriptPath}`,
    timeout: 15,
    statusMessage: "AI Traffic Lights"
  };
  return Object.fromEntries(
    CODEX_HOOK_EVENTS.map((eventName) => [
      eventName,
      [{ hooks: [handler] }]
    ])
  );
}

function mergeOurHooks(hooksDoc, ours) {
  const base = stripOurHooks(hooksDoc);
  const merged = { ...(base.hooks || {}) };
  for (const [eventName, groups] of Object.entries(ours)) {
    merged[eventName] = groups;
  }
  return { ...base, hooks: merged };
}

async function copyTree(srcDir, destDir) {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const from = join(srcDir, entry.name);
    const to = join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else {
      await copyFile(from, to);
    }
  }
}

function resolveHookSource(kitRoot) {
  const candidates = [
    resolve(kitRoot, "scripts", "codex", "hooks", "write-bridge-from-codex-hook.mjs"),
    resolve(kitRoot, "codex", "hooks", "write-bridge-from-codex-hook.mjs")
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }
  throw new Error(`Codex hook script not found under ${kitRoot}`);
}

export async function installCodexHooks(options = {}) {
  const kitRoot = options.kitRoot ?? getKitRoot();
  const nodePath = options.nodePath ?? process.env.AI_TL_NODE ?? process.execPath;
  const reconOnly = options.reconOnly === true;
  const hookScriptPath = resolve(GLOBAL_ROOT, "hooks", "write-bridge-from-codex-hook.mjs");
  const libSrc = resolve(kitRoot, "scripts", "lib");
  const hookSrc = resolveHookSource(kitRoot);

  await mkdir(dirname(USER_HOOKS_JSON), { recursive: true });
  await copyTree(libSrc, resolve(GLOBAL_ROOT, "lib"));
  await mkdir(dirname(hookScriptPath), { recursive: true });

  let hookSource = await readFile(hookSrc, "utf8");
  hookSource = hookSource.replaceAll("../lib/", "../lib/");
  await writeFile(hookScriptPath, hookSource, "utf8");

  let backupPath = null;
  try {
    await readFile(USER_HOOKS_JSON, "utf8");
    backupPath = `${USER_HOOKS_JSON}.bak.${MARKER}.${Date.now()}`;
    await copyFile(USER_HOOKS_JSON, backupPath);
  } catch {
    // no existing hooks.json
  }

  const existing = await readJson(USER_HOOKS_JSON, { hooks: {} });
  const ours = buildHookGroups(nodePath, hookScriptPath);
  const merged = mergeOurHooks(existing, ours);
  await writeFile(USER_HOOKS_JSON, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  const manifest = {
    marker: MARKER,
    version: 1,
    installedAt: new Date().toISOString(),
    hookScriptPath,
    hookEvents: CODEX_HOOK_EVENTS,
    globalRoot: GLOBAL_ROOT,
    hooksJsonBackup: backupPath,
    reconOnly
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return manifest;
}

export async function uninstallCodexHooks() {
  const hooksDoc = await readJson(USER_HOOKS_JSON, { hooks: {} });
  const stripped = stripOurHooks(hooksDoc);
  if (Object.keys(stripped.hooks || {}).length === 0) {
    const { unlink } = await import("node:fs/promises");
    try {
      await unlink(USER_HOOKS_JSON);
    } catch {
      // ignore
    }
  } else {
    await writeFile(USER_HOOKS_JSON, `${JSON.stringify(stripped, null, 2)}\n`, "utf8");
  }

  const { rm } = await import("node:fs/promises");
  await rm(GLOBAL_ROOT, { recursive: true, force: true });

  return { removed: GLOBAL_ROOT };
}

const cmd = process.argv[2];
const reconFlag = process.argv.includes("--recon");

if (cmd === "install") {
  installCodexHooks({ reconOnly: reconFlag })
    .then((m) => {
      console.log(reconFlag ? "Installed Codex recon hooks." : "Installed Codex bridge hooks.");
      console.log(`  hooks.json: ${USER_HOOKS_JSON}`);
      console.log(`  bridge root: ${GLOBAL_ROOT}`);
      if (m.hooksJsonBackup) {
        console.log(`  backup: ${m.hooksJsonBackup}`);
      }
      if (reconFlag) {
        console.log("  mode: recon only (logs to ~/.codex/ai-traffic-lights/recon/)");
        console.log("  next: run Agent in Codex App, then share recon JSONL");
      } else {
        console.log("  next: open Codex → /hooks → trust new hooks");
      }
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
} else if (cmd === "uninstall") {
  uninstallCodexHooks()
    .then((r) => {
      console.log("Removed Codex hooks and bridge data.");
      console.log(`  deleted: ${r.removed}`);
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
} else {
  console.error("Usage: node tools/merge-codex-hooks.mjs install [--recon] | uninstall");
  process.exitCode = 1;
}
