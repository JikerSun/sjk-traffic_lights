use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};
use tokio::time;

use crate::bridge::{read_state, resolve_bridge_path, StateEvent};
use crate::config::{guess_workspace_from_title, load_config, save_config, DesktopConfig};
use crate::hooks;
use crate::menu;
use crate::windows_util::{
    attach_to_window, hide_overlay, is_cursor_running, list_cursor_windows, show_overlay,
    window_fingerprint,
};

pub struct AppRuntime {
    pub config: DesktopConfig,
    pub bridge_path: Option<PathBuf>,
    pub last_state: Option<StateEvent>,
    pub free_position_mode: bool,
    pub cursor_was_running: bool,
    pub window_fingerprint: String,
    watcher: Option<RecommendedWatcher>,
}

impl AppRuntime {
    pub fn empty() -> Self {
        Self {
            config: DesktopConfig::default(),
            bridge_path: None,
            last_state: None,
            free_position_mode: false,
            cursor_was_running: false,
            window_fingerprint: String::new(),
            watcher: None,
        }
    }

    pub fn new() -> Result<Self, String> {
        let config = load_config()?;
        let free_position_mode = config.free_position.is_some() && !config.attached;
        Ok(Self {
            config,
            bridge_path: None,
            last_state: None,
            free_position_mode,
            cursor_was_running: is_cursor_running(),
            window_fingerprint: String::new(),
            watcher: None,
        })
    }

    pub fn ensure_hooks_on_first_run(&mut self, app: &AppHandle) {
        if hooks::is_installed() {
            return;
        }
        if let Err(err) = hooks::install_global_hooks(app) {
            eprintln!("[AI Traffic Lights] Hook auto-install skipped: {err}");
        }
    }

    pub fn bind_window(&mut self, app: &AppHandle, window_id: u32) -> Result<DesktopConfig, String> {
        let windows = list_cursor_windows()?;
        let info = windows
            .iter()
            .find(|w| w.id == window_id)
            .ok_or("Window not found")?;

        self.config.bound_window_id = Some(window_id);
        self.config.workspace_root = guess_workspace_from_title(&info.title);
        self.free_position_mode = false;
        self.config.free_position = None;
        self.config.attached = true;
        save_config(&self.config)?;

        if self.free_position_mode {
            if let Some((x, y)) = self.config.free_position {
                crate::windows_util::position_overlay(app, x, y)?;
            }
        } else {
            attach_to_window(app, window_id)?;
        }
        self.start_bridge_watch(app)?;
        Ok(self.config.clone())
    }

    pub fn attach_overlay(&mut self, app: &AppHandle) -> Result<(), String> {
        if self.free_position_mode {
            if let Some((x, y)) = self.config.free_position {
                crate::windows_util::position_overlay(app, x, y)?;
                show_overlay(app)?;
                return Ok(());
            }
        }
        let id = self
            .config
            .bound_window_id
            .ok_or("No window bound")?;
        attach_to_window(app, id)?;
        Ok(())
    }

    pub fn start_bridge_watch(&mut self, app: &AppHandle) -> Result<(), String> {
        let title = list_cursor_windows()?
            .into_iter()
            .find(|w| Some(w.id) == self.config.bound_window_id)
            .map(|w| w.title)
            .unwrap_or_default();

        let path = resolve_bridge_path(
            self.config.workspace_root.as_deref(),
            &title,
        );
        self.bridge_path = Some(path.clone());

        if let Some(mut old) = self.watcher.take() {
            let _ = old.unwatch(&path);
        }

        if let Some(state) = read_state(&path) {
            self.last_state = Some(state.clone());
            let _ = app.emit("bridge-state", &state);
        }

        let app_handle = app.clone();
        let path_watch = path.clone();
        let mut watcher = RecommendedWatcher::new(
            move |res: Result<notify::Event, notify::Error>| {
                if let Ok(event) = res {
                    if matches!(
                        event.kind,
                        EventKind::Modify(_) | EventKind::Create(_)
                    ) {
                        if let Some(state) = read_state(&path_watch) {
                            let _ = app_handle.emit("bridge-state", &state);
                        }
                    }
                }
            },
            Config::default(),
        )
        .map_err(|e| e.to_string())?;

        if path.parent().map(|p| p.exists()).unwrap_or(false) {
            let _ = watcher.watch(path.parent().unwrap(), RecursiveMode::NonRecursive);
        }
        self.watcher = Some(watcher);
        Ok(())
    }
}

pub fn spawn_background_tasks(app: AppHandle, state: Arc<Mutex<AppRuntime>>) {
    tauri::async_runtime::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(3));
        loop {
            interval.tick().await;
            let running = is_cursor_running();
            let mut guard = match state.lock() {
                Ok(g) => g,
                Err(_) => continue,
            };

            if running != guard.cursor_was_running {
                guard.cursor_was_running = running;
                if running {
                    if guard.config.setup_completed && guard.config.target_ide == "cursor" {
                        let windows = list_cursor_windows().unwrap_or_default();
                        if windows.len() == 1 && guard.config.bound_window_id.is_none() {
                            let _ = guard.bind_window(&app, windows[0].id);
                        }
                    }
                } else {
                    let _ = hide_overlay(&app);
                }
            }

            if !running {
                continue;
            }

            let windows = list_cursor_windows().unwrap_or_default();
            let fp = window_fingerprint(&windows);
            if !fp.is_empty() && fp != guard.window_fingerprint {
                guard.window_fingerprint = fp.clone();
                if guard.config.setup_completed
                    && guard.config.target_ide == "cursor"
                    && windows.len() == 1
                    && guard.config.bound_window_id.is_none()
                {
                    let _ = guard.bind_window(&app, windows[0].id);
                }
                menu::rebuild(&app);
            }
        }
    });
}
