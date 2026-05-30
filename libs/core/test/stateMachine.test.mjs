import test from "node:test";
import assert from "node:assert/strict";
import { reduceState, getLightRenderState, getMultiLightRenderState } from "../dist/stateMachine.js";

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
  const onFrame = getLightRenderState("WAITING_USER", 0, { blinkIntervalMs: 700, badgeMaxDisplay: 9 });
  const offFrame = getLightRenderState("WAITING_USER", 701, { blinkIntervalMs: 700, badgeMaxDisplay: 9 });
  assert.equal(onFrame.yellowBlinking, true);
  assert.equal(onFrame.yellowOn, true);
  assert.equal(offFrame.yellowOn, false);
  assert.equal(onFrame.displayMode, "single");
  assert.equal(onFrame.redBadge, undefined);
});

test("multi render shows badges and simultaneous lights", () => {
  const render = getMultiLightRenderState(
    { running: 2, waiting: 0, done: 3, error: 0, plan: 0 },
    0,
    { blinkIntervalMs: 700, badgeMaxDisplay: 9 }
  );
  assert.equal(render.displayMode, "multi");
  assert.equal(render.redOn, true);
  assert.equal(render.greenOn, true);
  assert.equal(render.redBadge, "2");
  assert.equal(render.greenBadge, "3");
});

test("multi error priority shows error badge on blinking red", () => {
  const render = getMultiLightRenderState(
    { running: 3, waiting: 0, done: 0, error: 1, plan: 0 },
    0,
    { blinkIntervalMs: 700, badgeMaxDisplay: 9 }
  );
  assert.equal(render.redBlinking, true);
  assert.equal(render.redBadge, "1");
});
