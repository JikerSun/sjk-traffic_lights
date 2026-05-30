use std::thread;

use tauri::{
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Manager, Wry,
};

use crate::{config::load_config, hooks, windows_util, AppState};

pub const MENU_REFRESH: &str = "menu_refresh";
pub const MENU_RESTORE: &str = "menu_restore";
pub const MENU_PICK: &str = "menu_pick";
pub const MENU_UNINSTALL: &str = "menu_uninstall";
pub const MENU_PREFERENCES: &str = "menu_preferences";

pub fn bind_menu_id(window_id: u32) -> String {
    format!("menu_bind:{window_id}")
}

pub fn build_menu(app: &AppHandle) -> Result<Menu<Wry>, String> {
    let config = load_config().unwrap_or_default();
    let bound = config.bound_window_id;
    let windows = windows_util::list_cursor_windows().unwrap_or_default();

    let refresh = MenuItem::with_id(
        app,
        MENU_REFRESH,
        "Refresh Window List",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let pick = MenuItem::with_id(app, MENU_PICK, "Select Window…", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let restore = MenuItem::with_id(
        app,
        MENU_RESTORE,
        "Restore Attach to Cursor",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let uninstall = MenuItem::with_id(
        app,
        MENU_UNINSTALL,
        "Uninstall Global Hooks",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let preferences = MenuItem::with_id(
        app,
        MENU_PREFERENCES,
        "Open Preferences…",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let separator = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let separator2 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let separator3 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit")).map_err(|e| e.to_string())?;

    let mut window_entries: Vec<MenuItem<Wry>> = Vec::new();
    if windows.is_empty() {
        window_entries.push(
            MenuItem::with_id(
                app,
                "menu_no_windows",
                "(No Cursor windows detected)",
                false,
                None::<&str>,
            )
            .map_err(|e| e.to_string())?,
        );
    } else {
        for w in &windows {
            let prefix = if bound == Some(w.id) { "✓ " } else { "" };
            let label = format!("{prefix}{} — {}", w.project_hint, w.title);
            window_entries.push(
                MenuItem::with_id(app, bind_menu_id(w.id), &label, true, None::<&str>)
                    .map_err(|e| e.to_string())?,
            );
        }
    }

    let mut window_refs: Vec<&dyn IsMenuItem<Wry>> = vec![&refresh, &separator];
    for item in &window_entries {
        window_refs.push(item);
    }
    window_refs.push(&pick);

    let window_sub = Submenu::with_items(app, "Window", true, &window_refs)
        .map_err(|e| e.to_string())?;
    let overlay_sub =
        Submenu::with_items(app, "Overlay", true, &[&restore]).map_err(|e| e.to_string())?;
    let uninstall_sub =
        Submenu::with_items(app, "Uninstall", true, &[&uninstall]).map_err(|e| e.to_string())?;

    let settings_sub = Submenu::with_items(
        app,
        "Settings",
        true,
        &[
            &window_sub,
            &overlay_sub,
            &uninstall_sub,
            &separator2,
            &preferences,
        ],
    )
    .map_err(|e| e.to_string())?;

    let app_sub = Submenu::with_items(
        app,
        "AI Traffic Lights",
        true,
        &[&settings_sub, &separator3, &quit],
    )
    .map_err(|e| e.to_string())?;

    Menu::with_items(app, &[&app_sub]).map_err(|e| e.to_string())
}

fn apply_menu(app: &AppHandle, menu: Menu<Wry>) {
    if cfg!(target_os = "macos") {
        let _ = app.set_menu(menu.clone());
    }

    #[cfg(not(target_os = "macos"))]
    if let Some(settings) = app.get_webview_window("settings") {
        let _ = settings.set_menu(menu.clone());
    }

    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_menu(Some(menu));
    }
}

fn rebuild_on_background(app: &AppHandle) {
    let Ok(menu) = build_menu(app) else {
        return;
    };
    apply_menu(app, menu);
}

pub fn rebuild(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        rebuild_on_background(&app);
    });
}

pub fn init(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        if app.tray_by_id("main").is_none() {
            let _ = init_tray(&app);
        }
        rebuild_on_background(&app);
    });
}

fn init_tray(app: &AppHandle) -> Result<(), String> {
    use tauri::tray::TrayIconBuilder;

    let menu = build_menu(app)?;
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "App icon missing".to_string())?;

    let _tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .menu(&menu)
        .tooltip("AI Traffic Lights")
        .build(app)
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn show_settings(app: &AppHandle) {
    if let Some(settings) = app.get_webview_window("settings") {
        let _ = settings.show();
        let _ = settings.unminimize();
        let _ = settings.set_focus();
    }
}

pub fn handle_menu_event(app: &AppHandle, menu_id: &str) {
    match menu_id {
        MENU_REFRESH => rebuild(app),
        MENU_RESTORE => {
            if let Some(state) = app.try_state::<AppState>() {
                if let Ok(mut rt) = state.inner.lock() {
                    rt.free_position_mode = false;
                    rt.config.free_position = None;
                    rt.config.attached = true;
                    let _ = crate::config::save_config(&rt.config);
                    let _ = rt.attach_overlay(app);
                }
            }
        }
        MENU_PICK => show_settings(app),
        MENU_PREFERENCES => show_settings(app),
        MENU_UNINSTALL => {
            let _ = hooks::uninstall_global_hooks(app);
            rebuild(app);
        }
        id if id.starts_with("menu_bind:") => {
            if let Some(raw) = id.strip_prefix("menu_bind:") {
                if let Ok(window_id) = raw.parse::<u32>() {
                    if let Some(state) = app.try_state::<AppState>() {
                        if let Ok(mut rt) = state.inner.lock() {
                            let _ = rt.bind_window(app, window_id);
                        }
                    }
                    rebuild(app);
                }
            }
        }
        _ => {}
    }
}
