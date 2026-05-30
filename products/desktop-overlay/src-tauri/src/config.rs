use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DesktopConfig {
    pub bound_window_id: Option<u32>,
    pub workspace_root: Option<String>,
    pub free_position: Option<(i32, i32)>,
    #[serde(default)]
    pub attached: bool,
    /// Target IDE: cursor | codex | other
    #[serde(default = "default_target_ide")]
    pub target_ide: String,
    #[serde(default)]
    pub setup_completed: bool,
}

fn default_target_ide() -> String {
    "cursor".to_string()
}

pub fn config_path() -> PathBuf {
    let home = dirs::home_dir().expect("home dir");
    home.join(".cursor")
        .join("ai-traffic-lights")
        .join("desktop-config.json")
}

pub fn load_config() -> Result<DesktopConfig, String> {
    let path = config_path();
    if !path.exists() {
        return Ok(DesktopConfig::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

pub fn save_config(config: &DesktopConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, serde_json::to_string_pretty(config).unwrap()).map_err(|e| e.to_string())
}

pub fn global_bridge_root() -> PathBuf {
    dirs::home_dir()
        .expect("home")
        .join(".cursor")
        .join("ai-traffic-lights")
}

pub fn workspace_state_id(workspace_root: &str) -> String {
    let normalized = normalize_path(workspace_root);
    let mut hasher = Sha256::new();
    hasher.update(normalized.as_bytes());
    hex::encode(hasher.finalize())[..16].to_string()
}

pub fn bridge_path_for_workspace(workspace_root: &str) -> PathBuf {
    global_bridge_root()
        .join("states")
        .join(workspace_state_id(workspace_root))
        .join("state.json")
}

fn normalize_path(path: &str) -> String {
    let p = Path::new(path);
    fs::canonicalize(p)
        .unwrap_or_else(|_| p.to_path_buf())
        .to_string_lossy()
        .to_string()
}

pub fn guess_workspace_from_title(title: &str) -> Option<String> {
    let states_dir = global_bridge_root().join("states");
    let entries = fs::read_dir(&states_dir).ok()?;
    let title_lower = title.to_lowercase();
    let mut best: Option<(String, u64)> = None;

    for entry in entries.flatten() {
        let state_file = entry.path().join("state.json");
        if !state_file.exists() {
            continue;
        }
        let Ok(raw) = fs::read_to_string(&state_file) else {
            continue;
        };
        let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw) else {
            continue;
        };
        let Some(root) = json.get("workspaceRoot").and_then(|v| v.as_str()) else {
            continue;
        };
        let base = Path::new(root)
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        if base.is_empty() {
            continue;
        }
        if title_lower.contains(&base.to_lowercase()) {
            let ts = json.get("ts").and_then(|v| v.as_u64()).unwrap_or(0);
            if best.as_ref().map(|(_, t)| ts > *t).unwrap_or(true) {
                best = Some((root.to_string(), ts));
            }
        }
    }
    best.map(|(r, _)| r)
}
