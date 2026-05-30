use crate::windows_util::CursorWindowInfo;

pub fn list_cursor_windows() -> Result<Vec<CursorWindowInfo>, String> {
    Err("Windows 窗口枚举将在下一版启用；请先在 macOS 上测试。".to_string())
}

pub fn is_window_fullscreen(_info: &CursorWindowInfo) -> bool {
    false
}

pub fn is_cursor_running() -> bool {
    use sysinfo::{ProcessRefreshKind, System};
    let mut system = System::new();
    system.refresh_processes_specifics(ProcessRefreshKind::new());
    system.processes().values().any(|process| {
        process
            .name()
            .to_string_lossy()
            .to_lowercase()
            .contains("cursor")
    })
}
