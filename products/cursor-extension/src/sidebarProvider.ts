import * as vscode from "vscode";
import type { TrafficLightEngine } from "./trafficLightCore.js";

const BUNDLED_IMAGE_DIR = "resources/image";

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private tick?: NodeJS.Timeout;
  private unsubscribe?: () => void;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly engine: TrafficLightEngine
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    const roots = [this.context.extensionUri, workspaceUri].filter(Boolean) as vscode.Uri[];
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: roots
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    this.unsubscribe = this.engine.subscribe(() => this.pushState());
    this.tick = setInterval(() => this.pushState(), 350);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.pushState();
      }
    });

    webviewView.onDidDispose(() => {
      if (this.tick) {
        clearInterval(this.tick);
      }
      if (this.unsubscribe) {
        this.unsubscribe();
      }
    });

    this.pushState();
  }

  private pushState(): void {
    if (!this.view) {
      return;
    }
    const snapshot = this.engine.getSnapshot();
    const renderState = this.engine.getRenderState();
    this.view.webview.postMessage({
      type: "state",
      state: snapshot.state,
      reason: snapshot.latestEvent?.reason ?? "No event",
      render: renderState
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const makeUri = (fileName: string): string => {
      const bundled = vscode.Uri.joinPath(this.context.extensionUri, BUNDLED_IMAGE_DIR, fileName);
      return webview.asWebviewUri(bundled).toString();
    };

    const panelBg = makeUri("panel_bg.png");
    const redOn = makeUri("light_red_on.png");
    const redOff = makeUri("light_red_off.png");
    const yellowOn = makeUri("light_yellow_on.png");
    const yellowOff = makeUri("light_yellow_off.png");
    const greenOn = makeUri("light_green_on.png");
    const greenOff = makeUri("light_green_off.png");

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        margin: 0;
        padding: 8.64px;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        font-family: var(--vscode-font-family);
      }
      .panel {
        position: relative;
        width: 60.48px;
        height: 161.46px;
      }
      .panel-bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      .light {
        position: absolute;
        width: 48.6px;
        height: 48.6px;
        left: 5.94px;
      }
      #red {
        top: 10.26px;
      }
      #yellow {
        top: 56.43px;
      }
      #green {
        top: 102.6px;
      }
      .meta {
        margin-top: 6.48px;
        font-size: 12px;
        opacity: 0.9;
      }
      .meta strong {
        display: inline-block;
        min-width: 28.08px;
      }
    </style>
  </head>
  <body>
    <div class="panel">
      <img class="panel-bg" src="${panelBg}" alt="panel background" />
      <img id="red" class="light" src="${redOff}" alt="red light" />
      <img id="yellow" class="light" src="${yellowOff}" alt="yellow light" />
      <img id="green" class="light" src="${greenOff}" alt="green light" />
    </div>
    <div class="meta"><strong>State:</strong><span id="state">IDLE</span></div>
    <div class="meta"><strong>Reason:</strong><span id="reason">No event</span></div>
    <script>
      const lightUrls = {
        redOn: "${redOn}",
        redOff: "${redOff}",
        yellowOn: "${yellowOn}",
        yellowOff: "${yellowOff}",
        greenOn: "${greenOn}",
        greenOff: "${greenOff}"
      };
      const stateEl = document.getElementById("state");
      const reasonEl = document.getElementById("reason");
      const redEl = document.getElementById("red");
      const yellowEl = document.getElementById("yellow");
      const greenEl = document.getElementById("green");

      window.addEventListener("message", (event) => {
        const msg = event.data;
        if (!msg || msg.type !== "state") return;
        stateEl.textContent = msg.state;
        reasonEl.textContent = msg.reason || "No reason";
        redEl.src = msg.render.redOn ? lightUrls.redOn : lightUrls.redOff;
        yellowEl.src = msg.render.yellowOn ? lightUrls.yellowOn : lightUrls.yellowOff;
        greenEl.src = msg.render.greenOn ? lightUrls.greenOn : lightUrls.greenOff;
      });
    </script>
  </body>
</html>`;
  }
}
