import test from "node:test";
import assert from "node:assert/strict";

test("commit path enters multi after second agent (hydrate v1)", async () => {
  const { mkdtemp, rm, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { commitBridgeUpdate } = await import("../lib/commit-bridge.mjs");

  const dir = await mkdtemp(join(tmpdir(), "tl-bridge-"));
  const bridgePath = join(dir, "state.json");
  const projectRoot = dir;
  const workspaceStateId = "test";

  try {
    await commitBridgeUpdate({
      bridgePath,
      overlayBridgePath: bridgePath,
      mirrorOverlay: false,
      workspaceStateId,
      projectRoot,
      hookPayload: { conversation_id: "agent-a", transcript_path: "/tmp/a.jsonl" },
      mapped: { state: "RUNNING", reason: "a", source: "test" },
      eventName: "preToolUse",
      forceWrite: true
    });

    const mid = JSON.parse(await readFile(bridgePath, "utf8"));
    assert.equal(mid.displayMode, undefined);

    await commitBridgeUpdate({
      bridgePath,
      overlayBridgePath: bridgePath,
      mirrorOverlay: false,
      workspaceStateId,
      projectRoot,
      hookPayload: { conversation_id: "agent-b", transcript_path: "/tmp/b.jsonl" },
      mapped: { state: "RUNNING", reason: "b", source: "test" },
      eventName: "preToolUse",
      forceWrite: true
    });

    const finalDoc = JSON.parse(await readFile(bridgePath, "utf8"));
    assert.equal(finalDoc.displayMode, "multi");
    assert.equal(finalDoc.counts.running, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
