import test from "node:test";
import assert from "node:assert/strict";
import { reduceState, getLightRenderState } from "../dist/stateMachine.js";

test("state follows newest event (WAITING_USER then DONE)", () => {
  const running = reduceState({ state: "IDLE" }, {
    tool: "cursor",
    sessionId: "s1",
    state: "RUNNING",
    ts: 1
  });
  const waiting = reduceState(running, {
    tool: "cursor",
    sessionId: "s1",
    state: "WAITING_USER",
    ts: 2
  });
  const doneAfterWait = reduceState(waiting, {
    tool: "cursor",
    sessionId: "s1",
    state: "DONE",
    ts: 3
  });
  assert.equal(doneAfterWait.state, "DONE");
});

test("yellow light blinks on alternating ticks", () => {
  const onFrame = getLightRenderState("WAITING_USER", 0, { blinkIntervalMs: 700 });
  const offFrame = getLightRenderState("WAITING_USER", 701, { blinkIntervalMs: 700 });
  assert.equal(onFrame.yellowBlinking, true);
  assert.equal(onFrame.yellowOn, true);
  assert.equal(offFrame.yellowOn, false);
});
