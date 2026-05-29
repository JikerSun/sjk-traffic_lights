#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const logPath = resolve(root, ".ai-traffic-lights/hook-events.log");
const maxRows = Number(process.argv[2] || 30);

function parseJsonLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function short(value, length = 72) {
  if (!value) {
    return "-";
  }
  const s = String(value).replace(/\s+/g, " ");
  return s.length > length ? `${s.slice(0, length)}...` : s;
}

async function run() {
  const raw = await readFile(logPath, "utf8");
  const rows = parseJsonLines(raw).slice(-maxRows);
  if (!rows.length) {
    console.log("No hook events found.");
    return;
  }

  console.log(`Hook events (latest ${rows.length}): ${logPath}`);
  console.log("time | event | mapped | prev | tool | stop | prompt/text");
  console.log("-".repeat(140));

  for (const row of rows) {
    const time = new Date(row.ts).toLocaleTimeString("en-US", { hour12: false });
    const event = short(row.event, 20);
    const mapped = short(row.mappedState, 16);
    const prev = short(row.previousState, 12);
    const payload = row.payload || {};
    const tool = short(payload.tool_name || payload.toolName || payload.mcp_tool_name || "-", 18);
    const stop = short(payload.status || "-", 12);
    const msg = short(payload.prompt || payload.text || "-", 72);
    console.log(`${time} | ${event} | ${mapped} | ${prev} | ${tool} | ${stop} | ${msg}`);
  }
}

run().catch((error) => {
  console.error(`inspect-hook-events failed: ${error.message}`);
  process.exitCode = 1;
});
