#!/usr/bin/env node

import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const root = process.cwd();
const markerPath = resolve(root, ".ai-traffic-lights/recon-test-marker.json");

const body = {
  label: process.argv.slice(2).join(" ") || "user marked start of recon test",
  ts: Date.now(),
  iso: new Date().toISOString()
};

await mkdir(dirname(markerPath), { recursive: true });
await writeFile(markerPath, JSON.stringify(body, null, 2), "utf8");
console.log(`Recon marker written: ${markerPath}`);
console.log(JSON.stringify(body, null, 2));
