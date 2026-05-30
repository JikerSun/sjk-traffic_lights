use std::process::Command;

use crate::windows_util::CursorWindowInfo;

/// List Cursor windows via CGWindowList (does not require Accessibility).
/// Falls back to AppleScript only if Swift fails.
pub fn list_cursor_windows() -> Result<Vec<CursorWindowInfo>, String> {
    match list_via_cgwindowlist() {
        Ok(windows) if !windows.is_empty() => Ok(windows),
        Ok(_) => list_via_applescript(),
        Err(cg_err) => list_via_applescript().map_err(|as_err| {
            format!("无法枚举 Cursor 窗口。CGWindow: {cg_err}；AppleScript: {as_err}")
        }),
    }
}

fn list_via_cgwindowlist() -> Result<Vec<CursorWindowInfo>, String> {
    let script = r#"
import Cocoa
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []
for w in list {
  guard (w["kCGWindowOwnerName"] as? String) == "Cursor" else { continue }
  guard (w["kCGWindowLayer"] as? Int ?? 0) == 0 else { continue }
  guard let num = w["kCGWindowNumber"] as? Int else { continue }
  guard let b = w["kCGWindowBounds"] as? [String: CGFloat] else { continue }
  let width = Int(b["Width"] ?? 0)
  let height = Int(b["Height"] ?? 0)
  if width < 200 || height < 200 { continue }
  let name = (w["kCGWindowName"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  let title = name.isEmpty ? "Cursor" : name
  let x = Int(b["X"] ?? 0)
  let y = Int(b["Y"] ?? 0)
  print("\(num)\t\(title)\t\(x)\t\(y)\t\(width)\t\(height)")
}
"#;

    let output = Command::new("swift")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("swift 不可用: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    parse_window_lines(&String::from_utf8_lossy(&output.stdout))
}

fn list_via_applescript() -> Result<Vec<CursorWindowInfo>, String> {
    let script = r#"
tell application "System Events"
  if not (exists process "Cursor") then return "ERR:Cursor 进程不存在"
  tell process "Cursor"
    set out to ""
    repeat with w in (every window)
      try
        set winName to name of w
        if winName is not "" then
          set winPos to position of w
          set winSize to size of w
          set winId to id of w
          set out to out & (winId as text) & tab & winName & tab & (item 1 of winPos as text) & tab & (item 2 of winPos as text) & tab & (item 1 of winSize as text) & tab & (item 2 of winSize as text) & linefeed
        end if
      end try
    end repeat
    return out
  end tell
end tell
"#;

    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| e.to_string())?;

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        if stderr.contains("-25211") || stderr.contains("辅助访问") {
            return Err(
                "需要「系统设置 → 隐私与安全性 → 辅助功能」中允许 AI Traffic Lights（开发模式请允许 target/debug/ai-traffic-lights-desktop）"
                    .to_string(),
            );
        }
        return Err(if stderr.is_empty() {
            "AppleScript 枚举窗口失败".to_string()
        } else {
            stderr
        });
    }

    let text = String::from_utf8_lossy(&output.stdout);
    if text.starts_with("ERR:") {
        return Err(text.trim().to_string());
    }
    parse_window_lines(&text)
}

fn parse_window_lines(text: &str) -> Result<Vec<CursorWindowInfo>, String> {
    let mut out = Vec::new();
    for line in text.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 6 {
            continue;
        }
        let id = parts[0].parse::<u32>().unwrap_or(0);
        if id == 0 {
            continue;
        }
        let title = parts[1].to_string();
        let x = parts[2].parse().unwrap_or(0);
        let y = parts[3].parse().unwrap_or(0);
        let width = parts[4].parse().unwrap_or(0);
        let height = parts[5].parse().unwrap_or(0);
        let project_hint = crate::config::guess_workspace_from_title(&title).unwrap_or_else(|| {
            if title == "Cursor" {
                format!("Cursor 窗口 #{id}")
            } else {
                title
                    .split(['—', '-', '–'])
                    .nth(1)
                    .unwrap_or(&title)
                    .trim()
                    .to_string()
            }
        });
        out.push(CursorWindowInfo {
            id,
            title,
            project_hint,
            x,
            y,
            width,
            height,
        });
    }
    out.sort_by(|a, b| a.title.cmp(&b.title));
    if out.is_empty() {
        return Err(
            "未找到 Cursor 窗口。请确认 Cursor 已打开且窗口未最小化到 Dock。"
                .to_string(),
        );
    }
    Ok(out)
}

pub fn is_window_fullscreen(info: &CursorWindowInfo) -> bool {
    if info.width < 200 || info.height < 200 {
        return false;
    }
    let script = r#"
import Cocoa
let screen = NSScreen.main?.frame ?? .zero
print("\(Int(screen.width))\t\(Int(screen.height))")
"#;
    if let Ok(output) = Command::new("swift").arg("-e").arg(script).output() {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            let parts: Vec<&str> = text.trim().split('\t').collect();
            if parts.len() >= 2 {
                if let (Ok(sw), Ok(sh)) = (parts[0].parse::<i32>(), parts[1].parse::<i32>()) {
                    return (info.width - sw).abs() <= 8
                        && (info.height - (sh - 34)).abs() <= 80;
                }
            }
        }
    }
    false
}

pub fn is_cursor_running() -> bool {
    let script = r#"
import Cocoa
let running = NSWorkspace.shared.runningApplications.contains { app in
  app.localizedName == "Cursor" || app.bundleIdentifier?.contains("cursor") == true
}
print(running ? "true" : "false")
"#;
    Command::new("swift")
        .arg("-e")
        .arg(script)
        .output()
        .map(|o| o.status.success() && String::from_utf8_lossy(&o.stdout).trim() == "true")
        .unwrap_or(false)
}
