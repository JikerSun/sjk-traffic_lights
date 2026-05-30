use serde::Serialize;
use tauri::{AppHandle, Manager, PhysicalPosition, WebviewWindow};

#[cfg(target_os = "macos")]
use crate::platform_macos as platform;
#[cfg(target_os = "windows")]
use crate::platform_windows as platform;

pub const OVERLAY_W: i32 = 62;
pub const OVERLAY_H: i32 = 162;

#[derive(Clone, Serialize)]
pub struct CursorWindowInfo {
    pub id: u32,
    pub title: String,
    pub project_hint: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

pub fn list_cursor_windows() -> Result<Vec<CursorWindowInfo>, String> {
    platform::list_cursor_windows()
}

pub fn find_window_by_id(id: u32) -> Result<CursorWindowInfo, String> {
    list_cursor_windows()?
        .into_iter()
        .find(|w| w.id == id)
        .ok_or_else(|| format!("Window {id} not found"))
}

pub fn window_fingerprint(windows: &[CursorWindowInfo]) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    for w in windows {
        w.id.hash(&mut hasher);
        w.title.hash(&mut hasher);
    }
    hasher.finish().to_string()
}

pub fn is_window_fullscreen(info: &CursorWindowInfo) -> bool {
    platform::is_window_fullscreen(info)
}

pub fn compute_attach_position(info: &CursorWindowInfo) -> (i32, i32) {
    if is_window_fullscreen(info) {
        (info.x + 8, info.y + 32)
    } else {
        let above_y = info.y - OVERLAY_H - 6;
        if above_y >= 0 {
            (info.x, above_y)
        } else {
            (info.x - OVERLAY_W - 6, info.y)
        }
    }
}

pub fn overlay_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("overlay")
}

pub fn position_overlay(app: &AppHandle, x: i32, y: i32) -> Result<(), String> {
    let overlay = overlay_window(app).ok_or("overlay window missing")?;
    overlay
        .set_position(PhysicalPosition::new(x.max(0), y.max(0)))
        .map_err(|e| e.to_string())
}

pub fn show_overlay(app: &AppHandle) -> Result<(), String> {
    let overlay = overlay_window(app).ok_or("overlay window missing")?;
    overlay.set_always_on_top(true).map_err(|e| e.to_string())?;
    overlay.show().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn hide_overlay(app: &AppHandle) -> Result<(), String> {
    if let Some(overlay) = overlay_window(app) {
        overlay.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn attach_to_window(app: &AppHandle, window_id: u32) -> Result<(i32, i32), String> {
    let info = find_window_by_id(window_id)?;
    let pos = compute_attach_position(&info);
    position_overlay(app, pos.0, pos.1)?;
    show_overlay(app)?;
    Ok(pos)
}

pub fn is_cursor_running() -> bool {
    platform::is_cursor_running()
}
