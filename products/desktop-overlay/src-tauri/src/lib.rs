mod bridge;
mod config;
mod hooks;
mod menu;
mod monitor;
#[cfg(target_os = "macos")]
mod platform_macos;
#[cfg(target_os = "windows")]
mod platform_windows;
mod windows_util;

use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager, State};

use config::{save_config, DesktopConfig};
use monitor::{spawn_background_tasks, AppRuntime};

pub struct AppState {
    inner: Arc<Mutex<AppRuntime>>,
}

#[tauri::command]
fn install_hooks(app: AppHandle) -> Result<String, String> {
    hooks::install_global_hooks(&app)
}

#[tauri::command]
fn uninstall_hooks(app: AppHandle) -> Result<String, String> {
    hooks::uninstall_global_hooks(&app)
}

#[tauri::command]
fn get_uninstall_instructions(app: AppHandle) -> Result<hooks::UninstallInstructions, String> {
    hooks::uninstall_instructions(&app)
}

#[tauri::command]
fn hooks_installed() -> bool {
    hooks::is_installed()
}

#[tauri::command]
fn list_cursor_windows() -> Result<Vec<windows_util::CursorWindowInfo>, String> {
    windows_util::list_cursor_windows()
}

#[tauri::command]
fn bind_window(
    app: AppHandle,
    state: State<'_, AppState>,
    window_id: u32,
) -> Result<DesktopConfig, String> {
    let mut rt = state.inner.lock().map_err(|e| e.to_string())?;
    let result = rt.bind_window(&app, window_id);
    drop(rt);
    menu::rebuild(&app);
    result
}

#[tauri::command]
fn set_target_ide(state: State<'_, AppState>, target_ide: String) -> Result<DesktopConfig, String> {
    let mut rt = state.inner.lock().map_err(|e| e.to_string())?;
    rt.config.target_ide = target_ide;
    save_config(&rt.config)?;
    Ok(rt.config.clone())
}

#[tauri::command]
fn finish_launch_setup(
    app: AppHandle,
    state: State<'_, AppState>,
    window_id: Option<u32>,
) -> Result<(), String> {
    let mut rt = state.inner.lock().map_err(|e| e.to_string())?;
    rt.config.setup_completed = true;
    save_config(&rt.config)?;

    if let Some(id) = window_id {
        if rt.config.target_ide == "cursor" {
            rt.bind_window(&app, id)?;
        }
    } else if rt.config.bound_window_id.is_some() && windows_util::is_cursor_running() {
        rt.attach_overlay(&app)?;
        rt.start_bridge_watch(&app)?;
    }

    drop(rt);
    menu::rebuild(&app);

    if let Some(setup) = app.get_webview_window("setup") {
        let _ = setup.close();
    }
    Ok(())
}

#[tauri::command]
fn restore_attach(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let mut rt = state.inner.lock().map_err(|e| e.to_string())?;
    rt.free_position_mode = false;
    rt.config.free_position = None;
    rt.config.attached = true;
    save_config(&rt.config)?;
    rt.attach_overlay(&app)
}

#[tauri::command]
fn set_free_position(
    app: AppHandle,
    state: State<'_, AppState>,
    x: i32,
    y: i32,
) -> Result<(), String> {
    let mut rt = state.inner.lock().map_err(|e| e.to_string())?;
    rt.free_position_mode = true;
    rt.config.free_position = Some((x, y));
    rt.config.attached = false;
    save_config(&rt.config)?;
    windows_util::position_overlay(&app, x, y)?;
    Ok(())
}

#[tauri::command]
fn get_config(state: State<'_, AppState>) -> Result<DesktopConfig, String> {
    let rt = state.inner.lock().map_err(|e| e.to_string())?;
    Ok(rt.config.clone())
}

#[tauri::command]
fn get_bridge_state(state: State<'_, AppState>) -> Result<Option<bridge::StateEvent>, String> {
    let rt = state.inner.lock().map_err(|e| e.to_string())?;
    Ok(rt.last_state.clone())
}

#[tauri::command]
fn cursor_is_running() -> bool {
    windows_util::is_cursor_running()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            install_hooks,
            uninstall_hooks,
            get_uninstall_instructions,
            hooks_installed,
            list_cursor_windows,
            bind_window,
            set_target_ide,
            finish_launch_setup,
            restore_attach,
            set_free_position,
            get_config,
            get_bridge_state,
            cursor_is_running,
        ])
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event.id().as_ref());
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let mut rt = AppRuntime::new()?;
            rt.ensure_hooks_on_first_run(&handle)?;

            // Launch setup window handles IDE/window choice each app start.
            // Runtime switching uses the menu bar Settings submenu.

            let shared = Arc::new(Mutex::new(rt));
            spawn_background_tasks(handle.clone(), shared.clone());
            app.manage(AppState { inner: shared });
            menu::init(&handle);

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {});
}
