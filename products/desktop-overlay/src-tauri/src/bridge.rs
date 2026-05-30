use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::config::{bridge_path_for_workspace, guess_workspace_from_title};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BridgeCounts {
    #[serde(default)]
    pub running: u32,
    #[serde(default)]
    pub waiting: u32,
    #[serde(default)]
    pub done: u32,
    #[serde(default)]
    pub error: u32,
    #[serde(default)]
    pub plan: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StateEvent {
    #[serde(default = "default_tool")]
    pub tool: String,
    pub state: String,
    #[serde(rename = "sessionId", default = "default_session")]
    pub session_id: String,
    pub reason: Option<String>,
    pub source: Option<String>,
    #[serde(rename = "workspaceRoot")]
    pub workspace_root: Option<String>,
    #[serde(rename = "workspaceStateId")]
    pub workspace_state_id: Option<String>,
    pub ts: u64,
    #[serde(rename = "bridgeVersion", default)]
    pub bridge_version: Option<u32>,
    #[serde(rename = "displayMode", default)]
    pub display_mode: Option<String>,
    #[serde(default)]
    pub counts: Option<BridgeCounts>,
}

fn default_tool() -> String {
    "cursor".to_string()
}

fn default_session() -> String {
    "cursor-session".to_string()
}

pub fn read_state(path: &PathBuf) -> Option<StateEvent> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn resolve_bridge_path(workspace_root: Option<&str>, window_title: &str) -> PathBuf {
    if let Some(root) = workspace_root {
        return bridge_path_for_workspace(root);
    }
    if let Some(guessed) = guess_workspace_from_title(window_title) {
        return bridge_path_for_workspace(&guessed);
    }
    // Fallback: most recently modified state file
    latest_state_file().unwrap_or_else(|| {
        bridge_path_for_workspace("/")
    })
}

fn latest_state_file() -> Option<PathBuf> {
    let states = crate::config::global_bridge_root().join("states");
    let mut best: Option<(PathBuf, std::time::SystemTime)> = None;
    for entry in fs::read_dir(&states).ok()?.flatten() {
        let path = entry.path().join("state.json");
        if !path.exists() {
            continue;
        }
        let Ok(meta) = fs::metadata(&path) else {
            continue;
        };
        let Ok(modified) = meta.modified() else {
            continue;
        };
        if best.as_ref().map(|(_, t)| modified > *t).unwrap_or(true) {
            best = Some((path, modified));
        }
    }
    best.map(|(p, _)| p)
}
