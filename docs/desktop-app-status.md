# 桌面悬浮 App — 实现状态与已知问题

> **最后更新：** 2026-05-30  
> **版本：** desktop **v0.1.1**（`products/desktop-overlay/package.json` / `tauri.conf.json`）  
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
- Node：优先 `which node`，再探测 `/opt/homebrew/bin`、`/usr/local/bin` 等；Finder 启动也会查找。**内置 Node 尚未打包**
- 首次 Hook 安装失败 **不再崩溃**；可在 Preferences 手动安装

### 2.5 卸载（Preferences）

- 按钮 **Uninstall AI Traffic Lights…** → **英文步骤弹窗**（不自动执行）
- 步骤：① Quit App → ② Terminal 跑 Hook 卸载命令（动态生成路径）→ ③ 删 `.app` → ④ 清空废纸篓 / 重启 Cursor
- Hook 卸载逻辑 = `merge-user-hooks.mjs uninstall`（删 `~/.cursor/ai-traffic-lights/`，清理 `hooks.json`）

### 2.6 打包（Mac）

```bash
npm run build:desktop
```

产物：

- `products/desktop-overlay/src-tauri/target/release/bundle/dmg/AI Traffic Lights_0.1.1_aarch64.dmg`（Apple Silicon）
- `.../bundle/macos/AI Traffic Lights.app`

本地副本（可选）：`install/desktop/mac/AI Traffic Lights_0.1.1_aarch64.dmg`

**Release 标签：** `desktop-v0.1.1`（见 [install/desktop/README.md](../install/desktop/README.md) §B）

---

## 3. Mac 分发与启动 — 迭代必读

> **给下一版维护者：** 发 dmg 前对照本节 + §5 发版检查；用户安装步骤见 [install/desktop/README.md](../install/desktop/README.md) §A。

### 3.1 两类「打不开」（不要混为一谈）

| 用户描述 | 实际原因 | 处理 |
|----------|----------|------|
| **「已损坏，无法打开」**，只有「移到废纸篓」 | 浏览器下载 **quarantine** + **未签名/未公证**；不是文件真坏 | `xattr -cr "/Applications/AI Traffic Lights.app"`，或右键 → 打开 |
| **「意外退出」**（能启动一瞬间再崩） | 多为 **v0.1.0** 的启动 bug；v0.1.1 已修 | 升级到 **desktop-v0.1.1**；见 §3.2 |

「系统设置 → 仍要打开」**不是总有**；很多 macOS 版本不会出现，**不能依赖**作为唯一指引。

### 3.2 Finder 启动 vs 终端启动（v0.1.0 根因 · v0.1.1 修复）

| 启动方式 | `PATH` | 首次 Hook 自装 |
|----------|--------|----------------|
| **终端**运行 `.app/Contents/MacOS/...` | 含 Homebrew `/opt/homebrew/bin` 等 | ✅ 通常成功 |
| **访达双击** | 通常只有 `/usr/bin:/bin:...` | v0.1.0：`node` 找不到 → `setup()` 返回 `Err` → **Tauri panic → 意外退出** |

**v0.1.1 代码约束（后续版本勿回退）：**

1. **`hooks::resolve_node`** — 必须用 **绝对路径** 探测常见 Node 位置（`/opt/homebrew/bin/node`、`/usr/local/bin/node`、`.fnm`、`.volta`、包内 `resources/node/…`），不能只依赖 `PATH` 里的 `node`。
2. **`ensure_hooks_on_first_run`** — Hook 安装失败 **不得** 让 `setup()` 返回 `Err`（Tauri 2 会在 `did_finish_launching` 里 **panic 整进程**）；失败只 `eprintln`，用户可在 Preferences 手动装 Hook。
3. **长期** — 内置 Node 打进 `resources/node/`（§5 优先级仍保留）。

**发版前自测（模拟同事访达环境）：**

```bash
# 临时移走 manifest，测「首次安装 Hook」路径
mv ~/.cursor/ai-traffic-lights/install-manifest.json{,.bak} 2>/dev/null || true

BUNDLE="products/desktop-overlay/src-tauri/target/release/bundle/macos/AI Traffic Lights.app/Contents/MacOS/ai-traffic-lights-desktop"
env -i HOME="$HOME" USER="$USER" LOGNAME="$LOGNAME" PATH="/usr/bin:/bin:/usr/sbin:/sbin" "$BUNDLE" &
sleep 3
kill %1 2>/dev/null

mv ~/.cursor/ai-traffic-lights/install-manifest.json.bak ~/.cursor/ai-traffic-lights/install-manifest.json 2>/dev/null || true
```

预期：**进程不崩溃**；若本机有 Homebrew Node，manifest 应被创建。

### 3.3 签名 / 公证 / App Store

| 方式 | 适用 | 说明 |
|------|------|------|
| **Developer ID + 公证** | GitHub Release dmg | 解决 Gatekeeper「已损坏」；需 Apple Developer $99/年 |
| **Mac App Store** | ❌ 不适合本产品 | 需沙盒；改 `~/.cursor/hooks.json`、私有 API 浮窗、读 Cursor 窗口等与 Store 策略冲突 |

未签名时：**文档必须写 `xattr -cr`**，不能假设用户能找到「仍要打开」。

### 3.4 菜单 `set_menu` 死锁（历史坑）

曾在 `setup()` **主线程** 调 `app.set_menu` → 启动卡死/spinning cursor。现 **`menu::init` / `menu::rebuild` 在后台线程** 执行。后续若改菜单初始化，**勿在主线程同步 `set_menu`**。

---

## 4. 已知问题与缺口

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| 1 | **Windows 窗口枚举未实现** | 🔴 | `platform_windows.rs` 为 stub；Windows 上无法绑窗/吸附 |
| 2 | **内置 Node 未随包分发** | 🟡 | 无 Node≥20 时 Preferences 内 Hook 安装会失败；App 不再因此闪退 |
| 3 | **未签名 / 未公证** | 🟡 | 下载后执行 `xattr -cr`；或「仍要打开」；未 Apple Notarize |
| 4 | **仅 aarch64 dmg 在本机验证** | 🟡 | Intel Mac 需 `--target x86_64-apple-darwin` 另打 |
| 5 | **菜单 Uninstall Global Hooks** | 🟡 | 仍是一键卸 Hook（无确认），与 Preferences 完整卸载说明不一致 |
| 6 | **拖 App 到废纸篓不会自动卸 Hook** | 🟡 | 需求 Q3「卸 App 同步卸 Hook」未做系统级钩子；靠 Preferences 弹窗引导 |
| 7 | **浮窗底栏白线** | 🟢  cosmetic | `panel_bg.png` 自带 Home 条装饰；曾裁切后已恢复原始 UI |
| 8 | **Codex / Other IDE** | 📋 | Setup 可选，逻辑未接；仅 Cursor 可用 |
| 9 | **黄灯 / Plan 灯** | ⏸ | 与 VSIX 相同，Hook 信号不足，未作为 App 交付项 |
| 10 | **GitHub Release 桌面包** | 🟡 | 文档已写上传步骤；**需维护者手动发 Release 附 dmg**（见 [install/desktop/README.md](../install/desktop/README.md)） |

---

## 5. 代码地图（桌面 App）

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

## 6. 下一步建议（优先级）

1. ~~发 **GitHub Release `desktop-v0.1.0`**~~ → **已发 `desktop-v0.1.1`**（含 Finder 启动修复 + 安装文档 `xattr`）
2. **Developer ID 签名 + 公证** — 减少用户 `xattr` 步骤（见 §3.3）
3. **Windows**：实现 `platform_windows.rs` + 在 Windows 机器上 `npm run build:desktop`
4. 内置 Node 打进 `resources/node/`
5. 菜单 **Uninstall** 改为打开 Preferences 卸载弹窗（或同样步骤说明）
6. Intel Mac x64 构建 / CI（GitHub Actions `macos-latest` + `windows-latest`)

## 7. 发版检查清单（Mac dmg）

- [ ] `npm run build:desktop` 成功，dmg 版本号与 `tauri.conf.json` 一致
- [ ] §3.2 **Finder PATH 自测** 通过（不意外退出）
- [ ] Release 说明含 **`xattr -cr`** 与 Node ≥20 要求
- [ ] `gh release create desktop-vX.Y.Z` 附 aarch64 dmg
- [ ] 更新本文 §2.6 版本路径、 [HANDOFF.md](HANDOFF.md) §0、[install/desktop/README.md](../install/desktop/README.md) §A

---

## 8. 相关文档

| 文档 | 用途 |
|------|------|
| [desktop-app-requirements.md](desktop-app-requirements.md) | 需求与产品决策 |
| [desktop-app-testing-mac.md](desktop-app-testing-mac.md) | Mac 测试步骤 |
| [install/desktop/README.md](../install/desktop/README.md) | **dmg 下载 / 安装 / Windows 打 exe** |
| [distribution.md](distribution.md) | 全产品分发总览 |
