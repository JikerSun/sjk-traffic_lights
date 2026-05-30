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

type TargetIde = "cursor" | "codex" | "other";

const windowList = document.getElementById("windowList")!;
const windowSection = document.getElementById("windowSection")!;
const windowError = document.getElementById("windowError")!;
const skipBtn = document.getElementById("skipBtn") as HTMLButtonElement;
const continueBtn = document.getElementById("continueBtn") as HTMLButtonElement;
const ideOptionButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".ide-option")
);

let wizardIde: TargetIde = "cursor";
let wizardWindowId: number | null = null;

function setWizardIde(ide: TargetIde): void {
  wizardIde = ide;
  for (const btn of ideOptionButtons) {
    btn.classList.toggle("selected", btn.dataset.ide === ide);
  }
  windowSection.classList.toggle("hidden", ide !== "cursor");
  windowError.textContent =
    ide === "cursor" ? "" : "This IDE is not supported yet. Choose Cursor or Set Up Later.";
}

async function loadWindows(): Promise<CursorWindowInfo[]> {
  return await invoke<CursorWindowInfo[]>("list_cursor_windows");
}

async function populateWindows(): Promise<void> {
  windowList.innerHTML = "";
  wizardWindowId = null;
  windowError.textContent = "";

  if (wizardIde !== "cursor") {
    return;
  }

  try {
    const windows = await loadWindows();
    const config = await invoke<DesktopConfig>("get_config");

    if (windows.length === 0) {
      windowError.textContent =
        "No Cursor windows found. Open Cursor first, or choose Set Up Later.";
      return;
    }

    for (const w of windows) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "picker-item";
      btn.textContent = `${w.project_hint}\n${w.title}`;
      if (config.bound_window_id === w.id) {
        btn.classList.add("selected");
        wizardWindowId = w.id;
      }
      btn.addEventListener("click", () => {
        wizardWindowId = w.id;
        for (const item of windowList.querySelectorAll("button")) {
          item.classList.remove("selected");
        }
        btn.classList.add("selected");
      });
      windowList.appendChild(btn);
    }

    if (windows.length === 1 && wizardWindowId === null) {
      wizardWindowId = windows[0].id;
      windowList.querySelector("button")?.classList.add("selected");
    }
  } catch (err) {
    windowError.textContent = String(err);
  }
}

async function finishLaunch(windowId: number | null): Promise<void> {
  await invoke("set_target_ide", { targetIde: wizardIde });
  await invoke("finish_launch_setup", { windowId });
}

for (const btn of ideOptionButtons) {
  btn.addEventListener("click", () => {
    setWizardIde((btn.dataset.ide as TargetIde) || "cursor");
    void populateWindows();
  });
}

skipBtn.addEventListener("click", () => {
  void finishLaunch(null);
});

continueBtn.addEventListener("click", () => {
  if (wizardIde !== "cursor") {
    windowError.textContent = "Only Cursor is supported. Choose Cursor or Set Up Later.";
    return;
  }
  if (!wizardWindowId) {
    windowError.textContent = "Select a Cursor window, or choose Set Up Later.";
    return;
  }
  void finishLaunch(wizardWindowId);
});

void (async () => {
  const config = await invoke<DesktopConfig>("get_config");
  wizardIde = (config.target_ide as TargetIde) || "cursor";
  setWizardIde(wizardIde);
  await populateWindows();
})();
