# 分发与安装（任意 Cursor 项目）

> 用户入口：[README.md](../README.md)（中文）· [README.en.md](../README.en.md)（English）  
> 接续总览见 [`HANDOFF.md`](HANDOFF.md)。

## 重要：两层安装

| 层级 | 装几次 | 作用 |
|------|--------|------|
| **A. Cursor 扩展** | 每台电脑 **1 次** | 侧边栏三盏灯（读 `state.json`） |
| **B. 全局 Hooks（推荐）** | 每台电脑 **1 次** | 所有打开的项目自动写状态 |
| ~~B. 每项目 Hooks~~ | 已过时 | 仅在不装全局时作备用 |

只装 A 不装 B → 灯不会随 AI 自动变。  
只装 B 不装 A → 可以改状态文件，但没有侧边栏 UI。

**不想翻源码：** 从仓库 [`install/`](../install/) 进入对应子目录即可。

---

## 推荐：一次装全局（所有文件夹生效）

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights
npm install
npm run install:global-hooks
npm run install:cursor-extension:local
```

或：构建 VSIX 后安装 [`install/cursor/extension/`](../install/cursor/extension/) 里的包。

然后 **Reload Window**。用 Cursor 打开**任意项目根目录**，跑 Agent 后侧边栏灯会随状态变化。

状态文件（按工作区隔离，不污染业务仓库）：

- macOS / Linux：`~/.cursor/ai-traffic-lights/states/<workspace-id>/state.json`
- Windows：`%USERPROFILE%\.cursor\ai-traffic-lights\states\<workspace-id>\state.json`

详见 [`install/cursor/global-hooks/README.md`](../install/cursor/global-hooks/README.md)。

---

## A. 扩展（本机一次）

### 方式 1：从 GitHub Release 装 VSIX

1. 在 [Releases](https://github.com/JikerSun/sjk-traffic_lights/releases) 下载 `ai-traffic-lights-cursor.vsix`
2. Cursor → `Cmd+Shift+P` → **Extensions: Install from VSIX...**
3. **Reload Window**

### 方式 2：从源码构建 VSIX

```bash
npm run package:extension
```

安装 **`install/cursor/extension/ai-traffic-lights-cursor.vsix`**。

### 方式 3：本地开发安装

```bash
npm run install:cursor-extension:local
```

---

## B. 全局 Hooks（本机一次，推荐）

```bash
npm run install:global-hooks
```

会：

- 安装脚本到 `~/.cursor/ai-traffic-lights/`
- 合并 `~/.cursor/hooks.json`（命令路径相对 `~/.cursor/`，安装前自动备份）
- 每个 Cursor 工作区使用独立 `state.json`（不会 A 项目 Agent 改掉 B 项目的灯）

若某项目里曾经 `bootstrap` 过，全局安装后**项目内 Hook 会自动跳过**，避免重复执行、双倍性能消耗。

---

## B2. 备用：仅单个项目 Hooks（不推荐）

仅在不方便写用户目录时使用：

```bash
install/cursor/workspace-hooks/bootstrap.sh /path/to/your-project
```

或 `npm run bootstrap -- /path/to/your-project`。

---

## 卸载（彻底）

按顺序执行，避免残留：

### 1. 卸全局 Hooks 与桥接数据

```bash
npm run uninstall:global-hooks
```

删除：

- `~/.cursor/ai-traffic-lights/`（含各工作区 `states/`）
- `~/.cursor/hooks.json` 中本工具相关条目（合并前若有备份在 `hooks.json.bak.ai-traffic-lights.*`）

### 2. 卸 Cursor 扩展

```bash
npm run uninstall:cursor-extension
```

或在 Cursor：**Extensions → AI Traffic Lights → Uninstall**。

### 3. 可选：清理曾 bootstrap 过的业务仓库

在每个项目根目录删除（若存在）：

- `.cursor/hooks.json` 里 traffic-lights 相关 command
- `.cursor/hooks/write-bridge-from-hook.mjs`
- `scripts/lib/` 下 bridge 相关 `.mjs`
- `.ai-traffic-lights/`（运行时目录）

最后 **Reload Window**。

**说明：** 无后台常驻进程；卸载后不会占用 CPU/内存。未删除的 `state.json` 只是磁盘上的小 JSON 文件，不是内存泄漏。

---

## C. 桌面悬浮 App（Mac dmg / Windows exe）

独立产品，不依赖 VSIX。Hook 由 App 首次启动安装。

| 平台 | 用户安装 | 维护者构建 |
|------|----------|------------|
| **Mac** | [Releases](https://github.com/JikerSun/sjk-traffic_lights/releases) 下载 `desktop-v*` 的 `.dmg` | `npm run build:desktop` → 上传 dmg |
| **Windows** | 待 Release 提供 `*-setup.exe` | **须在 Windows 上** 同命令构建 |

**完整说明（安装步骤、卸载、exe 源码路径、已知限制）：**  
[install/desktop/README.md](../install/desktop/README.md)

**实现状态、Mac 分发 pitfalls、发版检查清单：** [desktop-app-status.md](desktop-app-status.md)（**§3 迭代必读** · §7 发版清单）

---

## 快速检查清单

- [ ] 扩展已安装（命令面板能搜到 `AI Traffic Lights`）
- [ ] 已执行 `npm run install:global-hooks`（或确认 `~/.cursor/hooks.json` 含本工具）
- [ ] 当前窗口打开的是**项目根目录**
- [ ] 已 Reload Window
- [ ] Agent 跑一轮后，`~/.cursor/ai-traffic-lights/states/.../state.json` 中 `state` 会变

手动试灯：`Cmd+Shift+P` → `AI Traffic Lights: Set Running` / `Set Done`

---

## 性能说明

- Hook 仅在 Cursor 触发 Agent 事件时启动 **Node 子进程**，无 Agent 时 **零占用**。
- 扩展仅 **监听当前工作区** 对应的一个 `state.json`，无轮询、无额外 watcher 进程。
- 全局 + 项目双 Hook 已通过「全局已装则项目 Hook 立即退出」避免双倍执行。

---

## 已知能力边界

见 [`traffic-lights-runtime.md`](traffic-lights-runtime.md)。

---

## 安全说明

- 状态文件仅在 `~/.cursor/ai-traffic-lights/states/` 下，按工作区 hash 分子目录，不写入随意路径。
- 不要把 GitHub 密码交给他人或 AI；推送用 SSH / `gh auth login`。
