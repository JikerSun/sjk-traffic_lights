# 桌面悬浮 App — 实现状态与已知问题

> **最后更新：** 2026-05-30  
> **版本：** desktop **v0.1.0**（`products/desktop-overlay/package.json` / `tauri.conf.json`）  
> **接续：** 下次改 App 先读 **本文件 → [HANDOFF.md](HANDOFF.md) §0 → [desktop-app-requirements.md](desktop-app-requirements.md)**

---

## 1. 产品定位

| 项 | 说明 |
|----|------|
| 与 VSIX | **独立产品**；可不装侧边栏插件，仅装桌面 App |
| Hook | App **首次启动**自动执行与 `npm run install:global-hooks` 等价的安装 |
| 状态 | `fs.watch` 读 `~/.cursor/ai-traffic-lights/states/<id>/state.json` |
| 冻结 | **不得改** `products/cursor-extension/`；Hook 映射逻辑仅改 `scripts/lib/` + 经 `sync:hook-kit` 拷贝 |

---

## 2. 已实现功能（Mac · 2026-05-30）

### 2.1 启动流程（Setup 窗口 · 与菜单分离）

| 时机 | UI | 作用 |
|------|-----|------|
| **每次 App 启动** | 独立 `setup.html` 窗口（英文） | 选 IDE（Cursor / Codex / Other）+ 选 Cursor 窗口 → Continue / Set Up Later |
| **App 运行中** | 菜单 **Settings ▶** 子菜单 | Window / Overlay / Uninstall 快捷切换 |
| **完整设置** | 菜单 **Open Preferences…** → `settings.html` | Hook 安装、IDE、窗口下拉、卸载说明弹窗 |

**不要混淆：** Setup = 启动时；Settings 菜单 = 生命周期内切换。

### 2.2 浮窗（overlay）

- 三盏灯 + 拖动自由定位（Q1=B）
- **无**跟窗 loop；吸附仅在：启动绑定后、菜单 **Restore Attach**、Setup/菜单换窗时 **读一次** bounds
- Cursor 退出 → hide 浮窗；再起 → Setup 或菜单重新绑定
- always-on-top

### 2.3 菜单栏（英文 · macOS 顶栏）

```
AI Traffic Lights
  Settings ▶
    Window ▶     Refresh / 窗口列表(✓) / Select Window…
    Overlay ▶    Restore Attach to Cursor
    Uninstall ▶  Uninstall Global Hooks（运行中一键卸 Hook，无确认）
    ─────────
    Open Preferences…
  ─────────
  Quit
```

托盘图标菜单与顶栏一致。

### 2.4 Hook

- 首次启动：`AppRuntime::ensure_hooks_on_first_run` → `hooks::install_global_hooks`
- 资源：`src-tauri/resources/hook-kit/`（`npm run sync:hook-kit` 同步）
- Node：优先系统 Node ≥20，否则报错（**内置 Node 尚未打包**）

### 2.5 卸载（Preferences）

- 按钮 **Uninstall AI Traffic Lights…** → **英文步骤弹窗**（不自动执行）
- 步骤：① Quit App → ② Terminal 跑 Hook 卸载命令（动态生成路径）→ ③ 删 `.app` → ④ 清空废纸篓 / 重启 Cursor
- Hook 卸载逻辑 = `merge-user-hooks.mjs uninstall`（删 `~/.cursor/ai-traffic-lights/`，清理 `hooks.json`）

### 2.6 打包（Mac）

```bash
npm run build:desktop
```

产物：

- `products/desktop-overlay/src-tauri/target/release/bundle/dmg/AI Traffic Lights_0.1.0_aarch64.dmg`（Apple Silicon）
- `.../bundle/macos/AI Traffic Lights.app`

本地副本（可选）：`install/desktop/mac/AI Traffic Lights_0.1.0_aarch64.dmg`

---

## 3. 已知问题与缺口

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| 1 | **Windows 窗口枚举未实现** | 🔴 | `platform_windows.rs` 为 stub；Windows 上无法绑窗/吸附 |
| 2 | **内置 Node 未随包分发** | 🟡 | 无 Node≥20 时 Hook 安装/卸载命令会失败 |
| 3 | **未签名 / 未公证** | 🟡 | 首次打开需「仍要打开」；未 Apple Notarize |
| 4 | **仅 aarch64 dmg 在本机验证** | 🟡 | Intel Mac 需 `--target x86_64-apple-darwin` 另打 |
| 5 | **菜单 Uninstall Global Hooks** | 🟡 | 仍是一键卸 Hook（无确认），与 Preferences 完整卸载说明不一致 |
| 6 | **拖 App 到废纸篓不会自动卸 Hook** | 🟡 | 需求 Q3「卸 App 同步卸 Hook」未做系统级钩子；靠 Preferences 弹窗引导 |
| 7 | **浮窗底栏白线** | 🟢  cosmetic | `panel_bg.png` 自带 Home 条装饰；曾裁切后已恢复原始 UI |
| 8 | **Codex / Other IDE** | 📋 | Setup 可选，逻辑未接；仅 Cursor 可用 |
| 9 | **黄灯 / Plan 灯** | ⏸ | 与 VSIX 相同，Hook 信号不足，未作为 App 交付项 |
| 10 | **GitHub Release 桌面包** | 🟡 | 文档已写上传步骤；**需维护者手动发 Release 附 dmg**（见 [install/desktop/README.md](../install/desktop/README.md)） |

---

## 4. 代码地图（桌面 App）

```
products/desktop-overlay/
├── setup.html / src/setup.ts       # 启动向导（每次启动）
├── settings.html / src/settings.ts # Preferences + 卸载说明弹窗
├── overlay.html / src/overlay.ts   # 浮窗三灯
├── src-tauri/
│   ├── src/lib.rs                  # Tauri commands
│   ├── src/menu.rs                 # 顶栏/托盘菜单
│   ├── src/hooks.rs                # install/uninstall + 卸载说明命令
│   ├── src/monitor.rs              # Cursor 启停、窗口指纹
│   ├── src/platform_macos.rs       # CGWindowList + AppleScript 回退
│   ├── src/platform_windows.rs     # ⚠️ stub
│   └── resources/hook-kit/         # 构建前 sync:hook-kit
```

---

## 5. 下一步建议（优先级）

1. 发 **GitHub Release `desktop-v0.1.0`** 附 Mac dmg（见 install/desktop README）
2. **Windows**：实现 `platform_windows.rs` + 在 Windows 机器上 `npm run build:desktop`
3. 内置 Node 打进 `resources/node/`
4. 菜单 **Uninstall** 改为打开 Preferences 卸载弹窗（或同样步骤说明）
5. Intel Mac x64 构建 / CI（GitHub Actions `macos-latest` + `windows-latest`）

---

## 6. 相关文档

| 文档 | 用途 |
|------|------|
| [desktop-app-requirements.md](desktop-app-requirements.md) | 需求与产品决策 |
| [desktop-app-testing-mac.md](desktop-app-testing-mac.md) | Mac 测试步骤 |
| [install/desktop/README.md](../install/desktop/README.md) | **dmg 下载 / 安装 / Windows 打 exe** |
| [distribution.md](distribution.md) | 全产品分发总览 |
