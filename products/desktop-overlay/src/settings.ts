import { invoke } from "@tauri-apps/api/core";

type CursorWindowInfo = {
  id: number;
  title: string;
  project_hint: string;
};

type DesktopConfig = {
  bound_window_id?: number | null;
  target_ide?: string;
};

type UninstallInstructions = {
  hook_command: string;
  remove_app_command: string;
  app_bundle_path?: string | null;
};

const hookStatusEl = document.getElementById("hookStatus")!;
const cursorStatusEl = document.getElementById("cursorStatus")!;
const installBtn = document.getElementById("installBtn") as HTMLButtonElement;
const uninstallBtn = document.getElementById("uninstallBtn") as HTMLButtonElement;
const uninstallModal = document.getElementById("uninstallModal")!;
const hookCommandEl = document.getElementById("hookCommand")!;
const removeAppCommandEl = document.getElementById("removeAppCommand")!;
const removeAppHintEl = document.getElementById("removeAppHint")!;
const copyHookBtn = document.getElementById("copyHookBtn") as HTMLButtonElement;
const copyAppBtn = document.getElementById("copyAppBtn") as HTMLButtonElement;
const uninstallCloseBtn = document.getElementById("uninstallCloseBtn") as HTMLButtonElement;
const copyFeedbackEl = document.getElementById("copyFeedback")!;
const targetIdeEl = document.getElementById("targetIde") as HTMLSelectElement;
const targetHintEl = document.getElementById("targetHint")!;
const windowSelect = document.getElementById("windowSelect") as HTMLSelectElement;
const bindBtn = document.getElementById("bindBtn") as HTMLButtonElement;
const refreshWindowsBtn = document.getElementById("refreshWindowsBtn") as HTMLButtonElement;
const windowErrorEl = document.getElementById("windowError")!;
const restoreAttachBtn = document.getElementById("restoreAttachBtn") as HTMLButtonElement;

function updateTargetHint(ide: string): void {
  if (ide === "cursor") {
    targetHintEl.textContent = "Cursor window tracking and traffic lights are supported.";
  } else {
    targetHintEl.textContent = "Codex and other IDEs are coming soon. Please select Cursor for now.";
  }
}

function syncWindowSectionEnabled(ide: string): void {
  const enabled = ide === "cursor";
  windowSelect.disabled = !enabled;
  bindBtn.disabled = !enabled || !windowSelect.value;
  refreshWindowsBtn.disabled = !enabled;
  restoreAttachBtn.disabled = !enabled;
}

async function refreshHookStatus(): Promise<void> {
  const installed = await invoke<boolean>("hooks_installed");
  hookStatusEl.textContent = installed ? "Installed" : "Not installed";
  installBtn.disabled = installed;
}

async function refreshCursorStatus(): Promise<void> {
  const running = await invoke<boolean>("cursor_is_running");
  cursorStatusEl.textContent = running ? "Running" : "Not running";
}

async function loadWindows(): Promise<CursorWindowInfo[]> {
  return await invoke<CursorWindowInfo[]>("list_cursor_windows");
}

async function populateSelect(windows: CursorWindowInfo[]): Promise<void> {
  const config = await invoke<DesktopConfig>("get_config");
  windowSelect.innerHTML = "";
  windowErrorEl.textContent = "";

  if (windows.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No Cursor windows detected";
    windowSelect.appendChild(opt);
    bindBtn.disabled = true;
    return;
  }

  bindBtn.disabled = targetIdeEl.value !== "cursor";
  for (const w of windows) {
    const opt = document.createElement("option");
    opt.value = String(w.id);
    opt.textContent = `${w.project_hint} — ${w.title}`;
    if (config.bound_window_id === w.id) {
      opt.selected = true;
    }
    windowSelect.appendChild(opt);
  }
}

async function refreshWindows(): Promise<void> {
  if (targetIdeEl.value !== "cursor") {
    return;
  }
  try {
    const windows = await loadWindows();
    await populateSelect(windows);
  } catch (err) {
    windowSelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No Cursor windows detected";
    windowSelect.appendChild(opt);
    bindBtn.disabled = true;
    windowErrorEl.textContent = String(err);
  }
}

async function openUninstallModal(): Promise<void> {
  copyFeedbackEl.textContent = "";
  try {
    const info = await invoke<UninstallInstructions>("get_uninstall_instructions");
    hookCommandEl.textContent = info.hook_command;
    removeAppCommandEl.textContent = info.remove_app_command;
    if (info.app_bundle_path) {
      removeAppHintEl.textContent =
        "Then delete the app bundle (or run in Terminal after quitting):";
    } else {
      removeAppHintEl.textContent =
        "Then remove the app from your system (path may differ if not installed in Applications):";
    }
    uninstallModal.classList.remove("hidden");
  } catch (err) {
    copyFeedbackEl.textContent = String(err);
  }
}

async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    copyFeedbackEl.textContent = `${label} copied to clipboard.`;
  } catch {
    copyFeedbackEl.textContent = "Could not copy — select the command and copy manually.";
  }
}

targetIdeEl.addEventListener("change", () => {
  const ide = targetIdeEl.value;
  updateTargetHint(ide);
  syncWindowSectionEnabled(ide);
  void invoke("set_target_ide", { targetIde: ide });
  if (ide === "cursor") {
    void refreshWindows();
  }
});

installBtn.addEventListener("click", () => {
  void invoke<string>("install_hooks")
    .then(() => refreshHookStatus())
    .catch((err) => {
      hookStatusEl.textContent = String(err);
    });
});

uninstallBtn.addEventListener("click", () => {
  void openUninstallModal();
});

copyHookBtn.addEventListener("click", () => {
  void copyText(hookCommandEl.textContent || "", "Hook uninstall command");
});

copyAppBtn.addEventListener("click", () => {
  void copyText(removeAppCommandEl.textContent || "", "Remove app command");
});

uninstallCloseBtn.addEventListener("click", () => {
  uninstallModal.classList.add("hidden");
});

bindBtn.addEventListener("click", () => {
  const id = Number(windowSelect.value);
  if (!id) {
    return;
  }
  void invoke("bind_window", { windowId: id }).then(() => refreshWindows());
});

refreshWindowsBtn.addEventListener("click", () => {
  void refreshWindows();
});

restoreAttachBtn.addEventListener("click", () => {
  void invoke("restore_attach");
});

void (async () => {
  const config = await invoke<DesktopConfig>("get_config");
  targetIdeEl.value = config.target_ide || "cursor";
  updateTargetHint(targetIdeEl.value);
  syncWindowSectionEnabled(targetIdeEl.value);
  await refreshHookStatus();
  await refreshCursorStatus();
  await refreshWindows();
  setInterval(refreshCursorStatus, 3000);
})();
