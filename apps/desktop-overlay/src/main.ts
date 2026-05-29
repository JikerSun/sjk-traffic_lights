import { TrafficLightEngine } from "@traffic-lights/core";
import type { AiState, StateEvent } from "@traffic-lights/protocol";

import panelBg from "../../../image/panel_bg.png";
import redOn from "../../../image/light_red_on.png";
import redOff from "../../../image/light_red_off.png";
import yellowOn from "../../../image/light_yellow_on.png";
import yellowOff from "../../../image/light_yellow_off.png";
import greenOn from "../../../image/light_green_on.png";
import greenOff from "../../../image/light_green_off.png";

const engine = new TrafficLightEngine({ blinkIntervalMs: 700 });

const stateEl = document.getElementById("state")!;
const reasonEl = document.getElementById("reason")!;
const sourceEl = document.getElementById("source")!;
const redEl = document.getElementById("red") as HTMLImageElement;
const yellowEl = document.getElementById("yellow") as HTMLImageElement;
const greenEl = document.getElementById("green") as HTMLImageElement;
const panelBgEl = document.getElementById("panelBg") as HTMLImageElement;
const nextBtn = document.getElementById("nextBtn") as HTMLButtonElement;

panelBgEl.src = panelBg;

const sequence: AiState[] = ["RUNNING", "WAITING_USER", "DONE", "IDLE"];
let seqIdx = 0;

function render(): void {
  const snapshot = engine.getSnapshot();
  const renderState = engine.getRenderState();
  stateEl.textContent = snapshot.state;
  reasonEl.textContent = snapshot.latestEvent?.reason ?? "No event";
  sourceEl.textContent = snapshot.latestEvent?.source ?? "bridge/mock";
  redEl.src = renderState.redOn ? redOn : redOff;
  yellowEl.src = renderState.yellowOn ? yellowOn : yellowOff;
  greenEl.src = renderState.greenOn ? greenOn : greenOff;
}

engine.subscribe(() => render());
setInterval(render, 350);

nextBtn.addEventListener("click", () => {
  const state = sequence[seqIdx % sequence.length];
  seqIdx += 1;
  engine.consume({
    tool: "desktop-overlay",
    sessionId: "preview",
    state,
    reason: "Manual preview state",
    source: "preview",
    ts: Date.now()
  });
});

engine.consume({
  tool: "desktop-overlay",
  sessionId: "preview",
  state: "IDLE",
  reason: "Initialized",
  source: "preview",
  ts: Date.now()
});

let dragOffsetX = 0;
let dragOffsetY = 0;
const overlay = document.getElementById("overlay") as HTMLDivElement;
overlay.addEventListener("pointerdown", (event) => {
  const rect = overlay.getBoundingClientRect();
  dragOffsetX = event.clientX - rect.left;
  dragOffsetY = event.clientY - rect.top;
  overlay.setPointerCapture(event.pointerId);
});

overlay.addEventListener("pointermove", (event) => {
  if (!overlay.hasPointerCapture(event.pointerId)) {
    return;
  }
  overlay.style.position = "fixed";
  overlay.style.left = `${Math.round(event.clientX - dragOffsetX)}px`;
  overlay.style.top = `${Math.round(event.clientY - dragOffsetY)}px`;
});

overlay.addEventListener("pointerup", (event) => {
  if (overlay.hasPointerCapture(event.pointerId)) {
    overlay.releasePointerCapture(event.pointerId);
  }
});

async function pullBridgeState(): Promise<void> {
  try {
    const res = await fetch("/.ai-traffic-lights/state.json", { cache: "no-store" });
    if (!res.ok) {
      return;
    }
    const event = (await res.json()) as StateEvent;
    if (!event?.state) {
      return;
    }
    engine.consume(event);
  } catch {
    // keep last state when bridge file is unavailable
  }
}

setInterval(() => {
  void pullBridgeState();
}, 1200);
