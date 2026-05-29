#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseJsonLines, resolveStateFromTranscriptRows } from "./lib/cursor-transcript-state.mjs";

const transcriptPath = process.argv[2];
if (!transcriptPath) {
  console.error("Usage: node scripts/verify-transcript-state.mjs <transcript.jsonl>");
  process.exitCode = 1;
  process.exit(1);
}

const raw = await readFile(resolve(transcriptPath), "utf8");
const rows = parseJsonLines(raw);

console.log(`Transcript: ${transcriptPath}`);
console.log(`Rows: ${rows.length}`);
console.log(`Full state: ${JSON.stringify(resolveStateFromTranscriptRows(rows))}`);

for (let i = 1; i <= rows.length; i += 1) {
  const slice = rows.slice(0, i);
  const last = slice[slice.length - 1];
  const role = last?.role || "?";
  const resolved = resolveStateFromTranscriptRows(slice);
  const preview =
    role === "user"
      ? String(last?.message?.content?.[0]?.text || "").slice(0, 40)
      : role === "assistant"
        ? (last?.message?.content?.map((b) => b?.type === "tool_use" ? `tool:${b.name}` : "text").join("+") || "")
        : "";
  console.log(`[${i}] ${role} -> ${resolved.state} | ${preview}`);
}
