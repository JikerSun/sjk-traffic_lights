#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const logPath = resolve(root, ".ai-traffic-lights/recon-events.log");
const maxRows = Number(process.argv[2] || 50);
const onlyAsk = process.argv.includes("--ask");

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

function short(value, length = 64) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const s = String(value).replace(/\s+/g, " ");
  return s.length > length ? `${s.slice(0, length)}...` : s;
}

async function run() {
  let raw = "";
  try {
    raw = await readFile(logPath, "utf8");
  } catch {
    console.log(`No recon log yet: ${logPath}`);
    console.log("Reload Window after hooks.json change, then run: npm run debug:recon:mark");
    return;
  }

  let rows = parseJsonLines(raw);
  if (onlyAsk) {
    rows = rows.filter((row) => row.ask_hint);
  }
  rows = rows.slice(-maxRows);

  if (!rows.length) {
    console.log(onlyAsk ? "No ask_hint events in recon log." : "Recon log is empty.");
    return;
  }

  console.log(`Recon events (latest ${rows.length}${onlyAsk ? ", ask only" : ""}): ${logPath}`);
  console.log("iso | event | tool | ask | phase | stop | gen(last8)");
  console.log("-".repeat(120));

  for (const row of rows) {
    const iso = row.iso?.slice(11, 23) || "-";
    const gen = row.generation_id ? String(row.generation_id).slice(-8) : "-";
    console.log(
      `${iso} | ${short(row.event, 22)} | ${short(row.tool_name, 16)} | ${row.ask_hint ? "YES" : "no"} | ${short(row.transcript_phase, 18)} | ${short(row.stop_status, 8)} | ${gen}`
    );
  }

  const askRows = rows.filter((r) => r.ask_hint);
  if (!onlyAsk && askRows.length) {
    console.log(`\n★ ask_hint events in this window: ${askRows.length}`);
  }
}

run().catch((error) => {
  console.error(`inspect-recon-events failed: ${error.message}`);
  process.exitCode = 1;
});
