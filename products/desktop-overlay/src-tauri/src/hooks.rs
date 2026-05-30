use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::{AppHandle, Manager};

use crate::config;

pub fn is_installed() -> bool {
    let manifest = config::global_bridge_root().join("install-manifest.json");
    manifest.exists()
}

fn try_node_at(path: &Path) -> Option<PathBuf> {
    if !path.is_file() {
        return None;
    }
    let output = Command::new(path).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let version = String::from_utf8_lossy(&output.stdout);
    if node_version_ok(&version) {
        Some(path.to_path_buf())
    } else {
        None
    }
}

/// Resolve an absolute path to Node ≥20. Finder-launched apps have a minimal PATH,
/// so we probe common install locations after `which node`.
pub fn resolve_node(app: &AppHandle) -> Result<PathBuf, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(output) = Command::new("which").arg("node").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                candidates.push(PathBuf::from(path));
            }
        }
    }

    candidates.push(PathBuf::from("/opt/homebrew/bin/node"));
    candidates.push(PathBuf::from("/usr/local/bin/node"));
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".fnm/current/bin/node"));
        candidates.push(home.join(".volta/bin/node"));
    }

    let resource = app.path().resource_dir().map_err(|e| e.to_string())?;
    candidates.push(resource.join("node").join("bin").join("node"));

    let mut seen = HashSet::new();
    for path in candidates {
        if !seen.insert(path.clone()) {
            continue;
        }
        if let Some(ok) = try_node_at(&path) {
            return Ok(ok);
        }
    }

    Err(
        "需要 Node.js 20 或更高版本。请安装 Node 后重试，或在 Preferences 中手动安装 Hook。".to_string(),
    )
}

fn node_version_ok(raw: &str) -> bool {
    let digits: String = raw
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    let major = digits
        .split('.')
        .next()
        .and_then(|s| s.parse::<u32>().ok());
    major.unwrap_or(0) >= 20
}

pub fn hook_kit_root(app: &AppHandle) -> Result<PathBuf, String> {
    let resource = app.path().resource_dir().map_err(|e| e.to_string())?;
    let kit = resource.join("hook-kit");
    if kit.join("merge-user-hooks.mjs").exists() {
        return Ok(kit);
    }
    Err(format!(
        "Hook kit not found. Run: npm run sync:hook-kit (expected {})",
        kit.display()
    ))
}

pub fn install_global_hooks(app: &AppHandle) -> Result<String, String> {
    let node = resolve_node(app)?;
    let kit_root = hook_kit_root(app)?;
    let script = kit_root.join("merge-user-hooks.mjs");

    let output = Command::new(&node)
        .arg(&script)
        .arg("install")
        .env("AI_TL_KIT_ROOT", &kit_root)
        .env("AI_TL_NODE", &node)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "Hook install failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub fn uninstall_global_hooks(app: &AppHandle) -> Result<String, String> {
    let node = resolve_node(app)?;
    let kit_root = hook_kit_root(app)?;
    let script = kit_root.join("merge-user-hooks.mjs");

    let output = Command::new(&node)
        .arg(&script)
        .arg("uninstall")
        .env("AI_TL_KIT_ROOT", &kit_root)
        .env("AI_TL_NODE", &node)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "Hook uninstall failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[derive(serde::Serialize)]
pub struct UninstallInstructions {
    pub hook_command: String,
    pub remove_app_command: String,
    pub app_bundle_path: Option<String>,
}

pub fn app_bundle_path() -> Option<PathBuf> {
    let mut path = std::env::current_exe().ok()?;
    loop {
        if path
            .file_name()
            .map(|name| {
                name.to_string_lossy()
                    .to_lowercase()
                    .ends_with(".app")
            })
            .unwrap_or(false)
        {
            return Some(path);
        }
        if !path.pop() {
            break;
        }
    }
    None
}

pub fn uninstall_instructions(app: &AppHandle) -> Result<UninstallInstructions, String> {
    let kit_root = hook_kit_root(app)?;
    let script = kit_root.join("merge-user-hooks.mjs");
    let node = resolve_node(app).unwrap_or_else(|_| PathBuf::from("node"));
    let hook_command = format!(
        "AI_TL_KIT_ROOT=\"{}\" \"{}\" \"{}\" uninstall",
        kit_root.display(),
        node.display(),
        script.display()
    );

    let app_bundle_path = app_bundle_path().map(|p| p.display().to_string());
    let remove_app_command = if let Some(ref bundle) = app_bundle_path {
        format!("rm -rf \"{bundle}\"")
    } else if cfg!(target_os = "windows") {
        "Remove AI Traffic Lights from Settings → Apps → Installed apps.".to_string()
    } else {
        "Drag \"AI Traffic Lights\" from Applications to Trash.".to_string()
    };

    Ok(UninstallInstructions {
        hook_command,
        remove_app_command,
        app_bundle_path,
    })
}
