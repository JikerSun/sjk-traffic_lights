import * as vscode from "vscode";
import { watch as fsWatch } from "node:fs";
import { TrafficLightEngine, type AiState, type BridgeDocument, type StateEvent } from "./trafficLightCore.js";
import { SidebarProvider } from "./sidebarProvider.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { resolveBridgeFilePath } from "./bridgePaths.js";

const engine = new TrafficLightEngine({ blinkIntervalMs: 700 });

const VALID_STATES: ReadonlySet<AiState> = new Set([
  "IDLE",
  "RUNNING",
  "WAITING_USER",
  "WAITING_PLAN_BUILD",
  "DONE",
  "ERROR"
]);

const bridgeWatcherDispose = { dispose: (): void => undefined };

export function activate(context: vscode.ExtensionContext): void {
  const provider = new SidebarProvider(context, engine);

  context.subscriptions.push({
    dispose: () => bridgeWatcherDispose.dispose()
  });

  rebindBridgeWatcher();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("aiTrafficLightsCodex.sidebar", provider),
    vscode.workspace.onDidChangeWorkspaceFolders(() => rebindBridgeWatcher()),
    vscode.commands.registerCommand("aiTrafficLightsCodex.showStatusLights", async () => {
      await vscode.commands.executeCommand("workbench.view.explorer");
      await vscode.commands.executeCommand("aiTrafficLightsCodex.sidebar.focus");
    }),
    vscode.commands.registerCommand("aiTrafficLightsCodex.setRunning", () => setAndPersistState("RUNNING", "Manual command")),
    vscode.commands.registerCommand("aiTrafficLightsCodex.setWaiting", () => setAndPersistState("WAITING_USER", "Manual command")),
    vscode.commands.registerCommand("aiTrafficLightsCodex.setDone", () => setAndPersistState("DONE", "Manual command")),
    vscode.commands.registerCommand("aiTrafficLightsCodex.setIdle", () => setAndPersistState("IDLE", "Manual command")),
    vscode.commands.registerCommand("aiTrafficLightsCodex.setPlanWaiting", () =>
      setAndPersistState("WAITING_PLAN_BUILD", "Manual: plan awaiting Build")
    ),
    vscode.commands.registerCommand("aiTrafficLightsCodex.setError", () =>
      setAndPersistState("ERROR", "Manual: error")
    ),
    vscode.commands.registerCommand("aiTrafficLightsCodex.openBridgeFile", async () => {
      const uri = getBridgeUri();
      if (!uri) {
        void vscode.window.showWarningMessage("No workspace is open, cannot locate bridge file.");
        return;
      }
      await ensureBridgeFile(uri);
      await vscode.window.showTextDocument(uri);
    })
  );

  function setAndPersistState(state: AiState, reason: string): void {
    const snapshot = engine.setState(state, reason);
    const uri = getBridgeUri();
    if (!uri || !snapshot.latestEvent) {
      return;
    }
    void writeBridgeEvent(uri, snapshot.latestEvent);
  }
}

export function deactivate(): void {
  bridgeWatcherDispose.dispose();
}

function rebindBridgeWatcher(): void {
  bridgeWatcherDispose.dispose();

  const uri = getBridgeUri();
  if (!uri) {
    bridgeWatcherDispose.dispose = (): void => undefined;
    return;
  }

  const refresh = async (): Promise<void> => {
    await applyBridgeFile(uri);
  };

  const nodeWatcher = fsWatch(uri.fsPath, { persistent: false }, () => {
    void refresh();
  });

  bridgeWatcherDispose.dispose = () => {
    nodeWatcher.close();
  };

  void ensureBridgeFile(uri).then(() => void applyBridgeFile(uri));
}

function getBridgeUri(): vscode.Uri | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return undefined;
  }
  return vscode.Uri.file(resolveBridgeFilePath(root));
}

async function ensureBridgeFile(uri: vscode.Uri): Promise<void> {
  await mkdir(dirname(uri.fsPath), { recursive: true });
  try {
    await readFile(uri.fsPath, "utf8");
  } catch {
    const initial: StateEvent = {
      tool: "codex",
      sessionId: "codex-session",
      state: "IDLE",
      reason: "Initialized",
      source: "bridge",
      ts: Date.now()
    };
    await writeBridgeEvent(uri, initial);
  }
}

async function writeBridgeEvent(uri: vscode.Uri, event: StateEvent): Promise<void> {
  await writeFile(uri.fsPath, JSON.stringify(event, null, 2), "utf8");
}

async function applyBridgeFile(uri: vscode.Uri): Promise<void> {
  const parsed = await readBridgeDocument(uri);
  if (parsed) {
    engine.consumeBridge(parsed);
  }
}

async function readBridgeDocument(uri: vscode.Uri): Promise<BridgeDocument | undefined> {
  try {
    const raw = await readFile(uri.fsPath, "utf8");
    const parsed = JSON.parse(raw) as BridgeDocument;
    if (!parsed?.state || !parsed?.ts) {
      return undefined;
    }
    if (!VALID_STATES.has(parsed.state)) {
      return undefined;
    }
    if (!parsed.tool) {
      parsed.tool = "codex";
    }
    if (!parsed.sessionId) {
      parsed.sessionId = "codex-session";
    }
    return parsed;
  } catch {
    return undefined;
  }
}
