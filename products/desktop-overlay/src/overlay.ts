import { TrafficLightEngine } from "@traffic-lights/core";
import type { AiState, StateEvent } from "@traffic-lights/protocol";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import panelBg from "../../../image/panel_bg.png";
import redOn from "../../../image/light_red_on.png";
import redOff from "../../../image/light_red_off.png";
import yellowOn from "../../../image/light_yellow_on.png";
import yellowOff from "../../../image/light_yellow_off.png";
import greenOn from "../../../image/light_green_on.png";
import greenOff from "../../../image/light_green_off.png";

const engine = new TrafficLightEngine({ blinkIntervalMs: 700 });
const overlayWin = getCurrentWindow();

const redEl = document.getElementById("red") as HTMLImageElement;
const yellowEl = document.getElementById("yellow") as HTMLImageElement;
const greenEl = document.getElementById("green") as HTMLImageElement;
const panelBgEl = document.getElementById("panelBg") as HTMLImageElement;
const overlayRoot = document.getElementById("overlay") as HTMLDivElement;

panelBgEl.src = panelBg;

function render(): void {
  const renderState = engine.getRenderState();
  redEl.src = renderState.redOn ? redOn : redOff;
  yellowEl.src = renderState.yellowOn ? yellowOn : yellowOff;
  greenEl.src = renderState.greenOn ? greenOn : greenOff;
}

function consume(event: StateEvent): void {
  engine.consume(event);
  render();
}

engine.subscribe(() => render());
setInterval(render, 350);

void invoke<StateEvent | null>("get_bridge_state").then((event) => {
  if (event?.state) {
    consume(event as StateEvent);
  }
});

void listen<StateEvent>("bridge-state", (payload) => {
  if (payload.payload?.state) {
    consume(payload.payload);
  }
});

let dragStart: { x: number; y: number; winX: number; winY: number } | null = null;

overlayRoot.addEventListener("pointerdown", (event) => {
  void overlayWin.outerPosition().then((pos) => {
    dragStart = {
      x: event.screenX,
      y: event.screenY,
      winX: pos.x,
      winY: pos.y
    };
    overlayRoot.setPointerCapture(event.pointerId);
  });
});

overlayRoot.addEventListener("pointermove", (event) => {
  if (!dragStart || !overlayRoot.hasPointerCapture(event.pointerId)) {
    return;
  }
  const dx = event.screenX - dragStart.x;
  const dy = event.screenY - dragStart.y;
  const x = Math.round(dragStart.winX + dx);
  const y = Math.round(dragStart.winY + dy);
  void overlayWin.setPosition({ type: "Physical", x, y });
  void invoke("set_free_position", { x, y });
});

overlayRoot.addEventListener("pointerup", (event) => {
  if (overlayRoot.hasPointerCapture(event.pointerId)) {
    overlayRoot.releasePointerCapture(event.pointerId);
  }
  dragStart = null;
});

render();
