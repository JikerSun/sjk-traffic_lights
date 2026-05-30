use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::config::{bridge_path_for_workspace, guess_workspace_from_title};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StateEvent {
    pub state: String,
    pub reason: Option<String>,
    pub source: Option<String>,
    #[serde(rename = "workspaceRoot")]
    pub workspace_root: Option<String>,
    pub ts: u64,
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
