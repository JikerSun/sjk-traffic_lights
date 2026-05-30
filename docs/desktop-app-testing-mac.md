# Mac 测试指南 — AI Traffic Lights 桌面 App v0.1.2

> Windows 测试安排在下周一（同事机器）；本文仅 **macOS**。

---

## 1. 环境准备（一次性）

| 依赖 | 要求 | 检查命令 |
|------|------|----------|
| **Node.js** | ≥ 20（Hook 安装用；你本机已有 v24 即可） | `node --version` |
| **Rust** | stable（Tauri 编译） | `rustc --version` |
| **Xcode CLT** | macOS 编译 Tauri | `xcode-select -p` |

未装 Rust 时：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
```

若已装 Rust 但报 `cargo metadata ... No such file or directory`，先执行：

```bash
source "$HOME/.cargo/env"
```

（`npm run dev:desktop` 也会尝试自动 source；新开终端仍建议把 rustup 写入 `~/.zshrc`。）

---

## 2. 开发模式运行（推荐先测这个）

在仓库根目录：

```bash
cd /Users/jakiesun/Desktop/sjk-traffic_lights
npm install
npm run dev:desktop
```

会：

1. 同步 Hook 脚本到 `src-tauri/resources/hook-kit/`
2. 启动 Tauri 开发模式（设置窗口 + 浮窗）

**Multi Agent（v0.1.6+）：** 浮窗与侧边栏同读 `displayMode` + `counts`；测前确保 `npm run install:global-hooks` 为最新。

**首次启动：**

- App 会自动安装 **Cursor 全局 Hook**（等同以前的 `install:global-hooks`）
- 若只开 **1 个 Cursor 窗口** → 自动绑定并显示浮窗
- 若 **多个 Cursor 窗口** → 菜单 **AI Traffic Lights → 窗口** 中选择（✓ 标记当前绑定）；也可点 **选择窗口…** 打开设置内弹窗

---

## 3. 打正式包（可选）

```bash
npm run build:desktop
```

产物（默认路径）：

| 文件 | 路径 |
|------|------|
| `.app` | `products/desktop-overlay/src-tauri/target/release/bundle/macos/AI Traffic Lights.app` |
| `.dmg` | `products/desktop-overlay/src-tauri/target/release/bundle/dmg/AI Traffic Lights_0.1.2_aarch64.dmg` |

双击 `.app` 或从 DMG 拖入「应用程序」后，**Release 包测试**建议执行：

```bash
xattr -cr "/Applications/AI Traffic Lights.app"
```

---

## 3.1 Release 包专项测试（发版前必做）

对照 [desktop-app-status.md](desktop-app-status.md) **§3.2**：

1. **Gatekeeper / quarantine**：从浏览器下载 dmg 安装后，未 `xattr` 时是否提示「已损坏」；执行 `xattr -cr` 后能否打开。
2. **Finder 首次启动**：勿从终端启动，**访达双击**；预期 **不「意外退出」**，Hook manifest 可生成（需本机 Node ≥20，常见路径如 Homebrew）。
3. **模拟最小 PATH**（维护者）：

```bash
BUNDLE="/Applications/AI Traffic Lights.app/Contents/MacOS/ai-traffic-lights-desktop"
env -i HOME="$HOME" USER="$USER" PATH="/usr/bin:/bin" "$BUNDLE"
```

预期：进程存活，Setup 窗口出现。

---

## 4. 测试前请确认

- [ ] **Cursor 已打开**，且用 Cursor 打开的是**项目根目录**（例如 `sjk-traffic_lights`）
- [ ] 本机 **未** 再单独装 VSIX 侧边栏插件（可选；桌面 App 独立工作）
- [ ] macOS 若提示 **辅助功能 / 自动化** 权限，请允许（用于检测 Cursor 窗口与是否退出）

---

## 5. 测试步骤（建议顺序）

### A. Hook 自动安装

1. 启动 App → 打开 **设置窗口**
2. 「Cursor 全局 Hook」应显示 **已安装**
3. 检查文件存在：
   - `~/.cursor/ai-traffic-lights/install-manifest.json`
   - `~/.cursor/hooks.json` 中含 `write-bridge-from-hook.mjs`

若失败：点 **「安装 / 修复 Hook」**；仍失败看终端报错（需 Node ≥20）。

### B. 浮窗与吸附

1. 绑定 Cursor 窗口后，应看到 **三盏灯浮窗**（always-on-top）
2. **非全屏**：浮窗在 Cursor **窗口外上方**左上附近（一次性定位，无跟窗 loop）
3. **最大化 / 占满屏**：浮窗在 Cursor **内部**左上附近
4. **拖动**浮窗 → 位置固定
5. 菜单 **AI Traffic Lights → 浮窗 → 恢复吸附到 Cursor 窗口** → 重新吸附（浮窗上无按钮）

### C. 红绿灯状态

1. 在 Cursor 里跑一轮 **Agent**
2. 预期：**红灯（运行）→ 绿灯（结束）**
3. 自检：`~/.cursor/ai-traffic-lights/states/<id>/state.json` 中 `state` 随 Agent 变化

手动试灯（不跑 Agent）：

```bash
cd /Users/jakiesun/Desktop/sjk-traffic_lights
npm run debug:set:running
npm run debug:set:done
```

（需 Hook 已装；会写当前项目 bridge。）

### D. Cursor 退出

1. **Cmd+Q** 退出 Cursor
2. 浮窗应 **隐藏**
3. 再打开 Cursor → 重新走窗口绑定 → 浮窗再出现

### E. 多窗口

1. 打开 **两个** Cursor 窗口（不同项目）
2. 菜单 **AI Traffic Lights → 窗口** 应列出两个窗口；点击切换绑定（当前项带 ✓）
3. 或 **窗口 → 选择窗口…** 打开设置内弹窗选择

---

## 6. 常见问题

| 现象 | 处理 |
|------|------|
| **「已损坏，无法打开」** | 非文件损坏；`xattr -cr "/Applications/AI Traffic Lights.app"` 或右键 → 打开 |
| **「意外退出」** | 升级到 **desktop-v0.1.1+**；或终端启动看报错；见 [desktop-app-status.md](desktop-app-status.md) §3 |
| 浮窗不出现 | Cursor 是否在跑？是否已绑定窗口？看设置里「Cursor 状态」 |
| 灯不变 | Hook 是否已装？Reload Cursor；确认 `state.json` 在变 |
| osascript 报错 | 系统设置 → 隐私与安全性 → **辅助功能** → 允许 AI Traffic Lights / Terminal |
| `Port 1420 is already in use` | 上次 Vite 没退出：`lsof -ti :1420 \| xargs kill -9` 后重跑；或再执行 `npm run dev:desktop`（脚本会自动清理） |

---

## 7. 卸载 App（含 Hook）

当前 v0.1.0：**从应用程序删除 App 后**，在仓库根目录执行：

```bash
npm run uninstall:global-hooks
```

（下一版会在 App 内提供「完全卸载」按钮，行为与 Q3 一致。）

---

## 8. 相关文档

- [desktop-app-requirements.md](desktop-app-requirements.md) — 产品需求
- [desktop-app-status.md](desktop-app-status.md) — 功能、**Mac 分发 pitfalls（§3）**、发版清单（§7）
- [HANDOFF.md](HANDOFF.md) — 阶段与接续
