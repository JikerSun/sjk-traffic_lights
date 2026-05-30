#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "ai-traffic-lights";
const HOOK_EVENTS = [
  "beforeSubmitPrompt",
  "preToolUse",
  "postToolUse",
  "postToolUseFailure",
  "afterAgentResponse",
  "afterFileEdit",
  "stop",
  "sessionEnd"
];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function getKitRoot() {
  return process.env.AI_TL_KIT_ROOT ? resolve(process.env.AI_TL_KIT_ROOT) : ROOT;
}

const GLOBAL_ROOT = resolve(homedir(), ".cursor", "ai-traffic-lights");
const USER_HOOKS_JSON = resolve(homedir(), ".cursor", "hooks.json");
const MANIFEST_PATH = resolve(GLOBAL_ROOT, "install-manifest.json");

function isOurCommand(cmd) {
  if (typeof cmd !== "string") {
    return false;
  }
  return cmd.includes("ai-traffic-lights") && cmd.includes("write-bridge-from-hook.mjs");
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function buildHookCommands(nodePath = process.env.AI_TL_NODE || process.execPath) {
  const node = nodePath;
  const hookScript = "./ai-traffic-lights/hooks/write-bridge-from-hook.mjs";
  return Object.fromEntries(
    HOOK_EVENTS.map((eventName) => [
      eventName,
      [{ command: `${node} ${hookScript} ${eventName}` }]
    ])
  );
}

function stripOurHooks(hooksDoc) {
  if (!hooksDoc?.hooks || typeof hooksDoc.hooks !== "object") {
    return hooksDoc;
  }
  const nextHooks = {};
  for (const [eventName, entries] of Object.entries(hooksDoc.hooks)) {
    const kept = (Array.isArray(entries) ? entries : []).filter((e) => !isOurCommand(e?.command));
    if (kept.length) {
      nextHooks[eventName] = kept;
    }
  }
  return { ...hooksDoc, hooks: nextHooks };
}

function mergeOurHooks(hooksDoc, ours) {
  const base = stripOurHooks(hooksDoc);
  const merged = { ...(base.hooks || {}) };
  for (const [eventName, entries] of Object.entries(ours)) {
    merged[eventName] = entries;
  }
  return { ...base, version: base.version || 1, hooks: merged };
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
    resolve(kitRoot, ".cursor", "hooks", "write-bridge-from-hook.mjs"),
    resolve(kitRoot, "hooks", "write-bridge-from-hook.mjs")
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }
  throw new Error(
    `Hook script not found. Tried:\n${candidates.map((p) => `  - ${p}`).join("\n")}`
  );
}

export async function installGlobalHooks(options = {}) {
  const kitRoot = options.kitRoot ?? getKitRoot();
  const nodePath = options.nodePath ?? process.env.AI_TL_NODE ?? process.execPath;
  const hookScriptPath = resolve(GLOBAL_ROOT, "hooks", "write-bridge-from-hook.mjs");
  const libSrc = resolve(kitRoot, "scripts", "lib");
  const hookSrc = resolveHookSource(kitRoot);

  await mkdir(dirname(USER_HOOKS_JSON), { recursive: true });
  await copyTree(libSrc, resolve(GLOBAL_ROOT, "lib"));
  await mkdir(dirname(hookScriptPath), { recursive: true });
  let hookSource = await readFile(hookSrc, "utf8");
  hookSource = hookSource.replaceAll("../../scripts/lib/", "../lib/");
  await writeFile(hookScriptPath, hookSource, "utf8");

  let backupPath = null;
  try {
    await readFile(USER_HOOKS_JSON, "utf8");
    backupPath = `${USER_HOOKS_JSON}.bak.${MARKER}.${Date.now()}`;
    await copyFile(USER_HOOKS_JSON, backupPath);
  } catch {
    // no existing file
  }

  const existing = await readJson(USER_HOOKS_JSON, { version: 1, hooks: {} });
  const ours = buildHookCommands(nodePath);
  const merged = mergeOurHooks(existing, ours);
  await writeFile(USER_HOOKS_JSON, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  const manifest = {
    marker: MARKER,
    version: 1,
    installedAt: new Date().toISOString(),
    hookScriptPath,
    hookEvents: HOOK_EVENTS,
    globalRoot: GLOBAL_ROOT,
    hooksJsonBackup: backupPath
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return manifest;
}

export async function uninstallGlobalHooks() {
  const manifest = await readJson(MANIFEST_PATH, null);
  const hooksDoc = await readJson(USER_HOOKS_JSON, { version: 1, hooks: {} });
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

  return { removed: GLOBAL_ROOT, manifest };
}

const cmd = process.argv[2];
if (cmd === "install") {
  installGlobalHooks()
    .then((m) => {
      console.log("Installed global hooks.");
      console.log(`  hooks.json: ${USER_HOOKS_JSON}`);
      console.log(`  bridge root: ${GLOBAL_ROOT}`);
      if (m.hooksJsonBackup) {
        console.log(`  backup: ${m.hooksJsonBackup}`);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
} else if (cmd === "uninstall") {
  uninstallGlobalHooks()
    .then((r) => {
      console.log("Removed global hooks and bridge data.");
      console.log(`  deleted: ${r.removed}`);
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
} else {
  console.error("Usage: node tools/merge-user-hooks.mjs install|uninstall");
  process.exitCode = 1;
}
