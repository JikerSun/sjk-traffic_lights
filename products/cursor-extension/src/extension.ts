import * as vscode from "vscode";
import { TrafficLightEngine, type AiState, type StateEvent } from "./trafficLightCore.js";
import { SidebarProvider } from "./sidebarProvider.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const engine = new TrafficLightEngine({ blinkIntervalMs: 700 });
const BRIDGE_DIR = ".ai-traffic-lights";
const BRIDGE_FILE = "state.json";

const VALID_STATES: ReadonlySet<AiState> = new Set([
  "IDLE",
  "RUNNING",
  "WAITING_USER",
  "WAITING_PLAN_BUILD",
  "DONE",
  "ERROR"
]);

export function activate(context: vscode.ExtensionContext): void {
  const provider = new SidebarProvider(context, engine);
  const bridgeUri = getBridgeUri();

  if (bridgeUri) {
    watchBridgeFile(context, bridgeUri);
    void ensureBridgeFile(bridgeUri).then(() => void applyBridgeFile(bridgeUri));
  }

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("aiTrafficLights.sidebar", provider),
    vscode.commands.registerCommand("aiTrafficLights.showStatusLights", async () => {
      await vscode.commands.executeCommand("workbench.view.explorer");
      await vscode.commands.executeCommand("aiTrafficLights.sidebar.focus");
    }),
    vscode.commands.registerCommand("aiTrafficLights.setRunning", () => setAndPersistState("RUNNING", "Manual command")),
    vscode.commands.registerCommand("aiTrafficLights.setWaiting", () => setAndPersistState("WAITING_USER", "Manual command")),
    vscode.commands.registerCommand("aiTrafficLights.setDone", () => setAndPersistState("DONE", "Manual command")),
    vscode.commands.registerCommand("aiTrafficLights.setIdle", () => setAndPersistState("IDLE", "Manual command")),
    vscode.commands.registerCommand("aiTrafficLights.setPlanWaiting", () =>
      setAndPersistState("WAITING_PLAN_BUILD", "Manual: plan awaiting Build")
    ),
    vscode.commands.registerCommand("aiTrafficLights.setError", () =>
      setAndPersistState("ERROR", "Manual: error")
    ),
    vscode.commands.registerCommand("aiTrafficLights.openBridgeFile", async () => {
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

export function deactivate(): void {}

function getBridgeUri(): vscode.Uri | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  return root ? vscode.Uri.joinPath(root, BRIDGE_DIR, BRIDGE_FILE) : undefined;
}

function watchBridgeFile(context: vscode.ExtensionContext, bridgeUri: vscode.Uri): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return;
  }
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceRoot, `${BRIDGE_DIR}/${BRIDGE_FILE}`)
  );
  context.subscriptions.push(watcher);

  const refresh = async (changedUri: vscode.Uri): Promise<void> => {
    if (changedUri.fsPath !== bridgeUri.fsPath) {
      return;
    }
    await applyBridgeFile(bridgeUri);
  };

  context.subscriptions.push(
    watcher.onDidCreate((uri) => void refresh(uri)),
    watcher.onDidChange((uri) => void refresh(uri))
  );
}

async function ensureBridgeFile(uri: vscode.Uri): Promise<void> {
  await mkdir(dirname(uri.fsPath), { recursive: true });
  try {
    await readFile(uri.fsPath, "utf8");
  } catch {
    const initial: StateEvent = {
      tool: "cursor",
      sessionId: "default",
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
  const parsed = await readBridgeEvent(uri);
  if (parsed) {
    engine.consume(parsed);
  }
}

async function readBridgeEvent(uri: vscode.Uri): Promise<StateEvent | undefined> {
  try {
    const raw = await readFile(uri.fsPath, "utf8");
    const parsed = JSON.parse(raw) as StateEvent;
    if (!parsed?.state || !parsed?.tool || !parsed?.sessionId || !parsed?.ts) {
      return undefined;
    }
    if (!VALID_STATES.has(parsed.state)) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}
