# AI Traffic Lights

在 Cursor 侧边栏用 **红 / 黄 / 绿** 三盏灯表示 Agent 状态：运行中、等待用户、已完成。

**仓库：** https://github.com/JikerSun/sjk-traffic_lights  
**当前稳定版：** [v0.1.6](https://github.com/JikerSun/sjk-traffic_lights/releases/tag/v0.1.6) · VSIX：`ai-traffic-lights-cursor.vsix`（Multi Agent）

### 项目阶段

| 阶段 | 状态 |
|------|------|
| Cursor 侧边栏插件（Mac） | ✅ **v0.1.6**（Multi Agent 计数 + Single 回归 + 全局 Hook） |
| Cursor 侧边栏插件（Windows） | 🧪 待同事实测 VSIX（安装步骤与 Mac 相同） |
| **桌面悬浮窗 App（Mac）** | ✅ **v0.1.2** — [下载 dmg](https://github.com/JikerSun/sjk-traffic_lights/releases/tag/desktop-v0.1.2) · Multi Agent · [安装说明](install/desktop/README.md) |
| 桌面悬浮窗 App（Windows） | 🔴 需 Windows 机构 `.exe`；窗口 API 未实现，见 [install/desktop/README.md](install/desktop/README.md) §C |
| 黄灯 / Plan 模式 | ⏸ 依赖 Cursor 信号，暂不作为交付要求 |

---

## 工作原理（两层，缺一不可才能「自动变灯」）

| 层级 | 装几次 | 作用 | 装在哪 |
|------|--------|------|--------|
| **A. Cursor 扩展** | 每台电脑 1 次 | 侧边栏 **Status Lights**（读状态、显示三盏灯） | VSIX 或本地安装 → `~/.cursor/extensions/` |
| **B. 全局 Hooks** | 每台电脑 1 次 | Agent 运行时**自动写状态** | `~/.cursor/hooks.json` + `~/.cursor/ai-traffic-lights/` |

```
Cursor Agent 事件
  → ~/.cursor/hooks.json 调用 write-bridge-from-hook.mjs
  → ~/.cursor/ai-traffic-lights/states/<工作区ID>/state.json
  → 扩展 fs.watch 读该文件 → 侧边栏变灯
```

- **只装扩展、不装 Hooks** → 有侧边栏，但灯**不会**随 Agent 自动变（可用手动命令试灯）。
- **只装 Hooks、不装扩展** → 状态文件会变，但**没有**侧边栏 UI。
- **每个打开的项目文件夹**有独立的 `state.json`（按路径 hash），多项目**不会串灯**。

需要 **Node.js ≥ 20**（仅安装/卸载 Hooks 时用，日常用 Cursor 不常驻 Node 进程）。

---

## 安装（推荐：Release VSIX + 全局 Hook）

### 步骤 1：安装侧边栏扩展（VSIX）

1. 打开 **[Releases](https://github.com/JikerSun/sjk-traffic_lights/releases)**，下载 **`ai-traffic-lights-cursor.vsix`**（请用 **v0.1.6**；v0.1.5 无 Multi Agent）
2. **若重装：** 先 `Cmd+Q` 完全退出 Cursor，再安装（避免 `Please restart VS Code before reinstalling`）
3. Cursor → 命令面板（Mac `Cmd+Shift+P` / Windows `Ctrl+Shift+P`）→ **Extensions: Install from VSIX...** → 选择该文件  
   或 Cursor 关闭时：`"/Applications/Cursor.app/Contents/Resources/app/bin/cursor" --install-extension /path/to.vsix`
4. Reload Window

### 步骤 2：安装全局 Hooks

**需要 clone 本仓库一次**（Hooks 安装脚本在仓库里；VSIX 本身不含 Hooks）。

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights
npm install
npm run install:global-hooks
```

脚本会：

- 复制 Hook 脚本到 `~/.cursor/ai-traffic-lights/hooks/`、`lib/`
- **合并** `~/.cursor/hooks.json`（若已有其它 Hook，只追加本工具条目；安装前自动备份为 `hooks.json.bak.ai-traffic-lights.<时间戳>`）
- 写入 `~/.cursor/ai-traffic-lights/install-manifest.json`（供卸载脚本识别）

**不会**修改你的业务项目代码；状态写在用户目录，不污染各仓库。

### 步骤 3：启用

1. Cursor → **Reload Window**
2. 用 Cursor 打开**任意项目的根目录**（不要只打开子文件夹）
3. 打开 **Status Lights**（命令面板：`AI Traffic Lights: Show Status Lights`）
4. 跑一轮 Agent → 应看到 **红灯（运行）→ 绿灯（结束）**

**状态文件示例：**

- macOS / Linux：`~/.cursor/ai-traffic-lights/states/<workspace-id>/state.json`
- Windows：`%USERPROFILE%\.cursor\ai-traffic-lights\states\<workspace-id>\state.json`

自检：Agent 跑完后打开该文件，`state` 应在 `RUNNING` / `DONE` 等之间变化，且 `workspaceRoot` 为**当前项目路径**（不能是 `.cursor` 用户目录本身）。

---

## 卸载（彻底）

扩展与 Hooks 是**两套东西**，建议都卸干净。最后 **Reload Window**。

### 方式 A：已 clone 过仓库（推荐）

在 `sjk-traffic_lights` 目录下：

```bash
# 1. 卸全局 Hooks + 桥接数据
npm run uninstall:global-hooks

# 2. 卸扩展（删 ~/.cursor/extensions/local.ai-traffic-lights-cursor-extension-*）
npm run uninstall:cursor-extension
```

`uninstall:global-hooks` 会：

- 删除整个 `~/.cursor/ai-traffic-lights/`（含各工作区 `states/`）
- 从 `~/.cursor/hooks.json` **移除**本工具相关 command（保留你其它 Hook）
- 若合并后 `hooks.json` 为空，会删除该文件

然后 **Reload Window**。

### 方式 B：只装过 VSIX、未 clone 仓库

| 要卸什么 | 怎么做 |
|----------|--------|
| **扩展（VSIX）** | Cursor → **Extensions** → **AI Traffic Lights** → **Uninstall** → Reload；或 Cursor 关闭时：`cursor --uninstall-extension local.ai-traffic-lights-cursor-extension`（Mac 完整路径见 [install/cursor/extension/README.md](install/cursor/extension/README.md)） |
| **全局 Hooks** | 须 **clone 仓库** 后执行 `npm install && npm run uninstall:global-hooks`（同方式 A 第 1 步） |

仅卸扩展、不卸 Hooks：侧边栏没了，但 Agent 仍可能触发 Hook 写文件（无 UI、几乎无性能影响）。要彻底干净请卸 Hooks。

### 可选：曾用「单项目 bootstrap」装过 Hook

在每个装过的项目根目录，手动删除（若存在）：

- `.cursor/hooks.json` 里与本工具相关的 command
- `.cursor/hooks/write-bridge-from-hook.mjs`
- `scripts/lib/` 下 bridge 相关 `.mjs`
- `.ai-traffic-lights/`（运行时目录）

全局 Hook 已装时，项目内旧 Hook 会自动跳过，但删除上述文件可避免混淆。

**说明：** 无后台常驻服务；卸载后不占 CPU/内存。漏删的 `state.json` 只是磁盘上的小 JSON，不是内存泄漏。

---

## 安装后检查清单

- [ ] Extensions 里能看到 **AI Traffic Lights**，或命令面板能搜到相关命令
- [ ] 已执行 `npm run install:global-hooks`，且存在 `~/.cursor/ai-traffic-lights/install-manifest.json`
- [ ] `~/.cursor/hooks.json` 中含 `ai-traffic-lights` / `write-bridge-from-hook.mjs`
- [ ] 当前窗口打开的是**项目根目录**
- [ ] 已 **Reload Window**
- [ ] Agent 跑一轮后，对应 `states/.../state.json` 里 `state` 会变化

**手动试灯（不跑 Agent）：** `Cmd+Shift+P` → `AI Traffic Lights: Set Running` / `Set Done`

**仍不变灯时：** Output 面板 → 选 **Hooks** 看报错；确认 `state.json` 里 `workspaceRoot` 是否为当前项目路径。

---

## 桌面悬浮 App（Mac · 独立产品）

不装 VSIX 也可使用：always-on-top 三盏灯浮窗 + App 代装全局 Hook。

### 下载安装（Mac）

1. 打开 **[GitHub Releases](https://github.com/JikerSun/sjk-traffic_lights/releases)**，下载标签 **`desktop-v0.1.2`** 中的  
   **`AI Traffic Lights_0.1.2_aarch64.dmg`**（Apple Silicon）
2. 双击 dmg → 拖到 **Applications**
3. 去掉下载隔离：`xattr -cr "/Applications/AI Traffic Lights.app"`
4. 双击打开（若仍被拦：**系统设置 → 隐私与安全性 → 仍要打开**）
5. 启动 **Setup** 向导：选 IDE + Cursor 窗口 → **Continue**
6. 需要 **Node.js ≥ 20**（Hook 安装/卸载；App 会自动查找 Homebrew 等路径）

详细步骤、卸载、本地构建：[install/desktop/README.md](install/desktop/README.md)  
功能与已知问题：[docs/desktop-app-status.md](docs/desktop-app-status.md)

> **维护者发 Release：** 本地 `npm run build:desktop` 后 `gh release create desktop-v0.1.2 --attach dmg`，见 install/desktop §B。

### Windows `.exe`

**不能在 Mac 上交叉打出 exe。** 需在 Windows 10/11 上 clone 仓库并 `npm run build:desktop`，产物在  
`products/desktop-overlay/src-tauri/target/release/bundle/nsis/*-setup.exe`。  
完整步骤与源码路径：[install/desktop/README.md](install/desktop/README.md) §C。

---

## 其它安装方式

| 方式 | 说明 |
|------|------|
| [Releases VSIX](https://github.com/JikerSun/sjk-traffic_lights/releases) + `install:global-hooks` | **推荐给同事（侧边栏）** |
| [Releases desktop dmg](https://github.com/JikerSun/sjk-traffic_lights/releases) | **桌面浮窗 App（Mac）** |
| `npm run install:cursor-extension:local` | 开发者从源码装扩展（非 VSIX） |
| `npm run package:extension` | 本地打 VSIX → `install/cursor/extension/` |
| `install/cursor/workspace-hooks/bootstrap.sh <项目>` | **备用**：仅单个项目 Hook，不推荐日常使用 |

目录说明：[install/](install/) · 开发接续：[docs/HANDOFF.md](docs/HANDOFF.md) · 桌面 App：[docs/desktop-app-status.md](docs/desktop-app-status.md)

---

## 功能与限制

| 能力 | 状态 |
|------|------|
| 红灯 `RUNNING` / 绿灯 `DONE` / 红闪 `ERROR` | ✅ 稳定 |
| 黄灯 `WAITING_USER`（AskQuestion） | ⚠️ 依赖 Cursor 信号，多数仍为红灯 |
| Plan 红黄闪 `WAITING_PLAN_BUILD` | ⚠️ Plan Hook 难 latch，多数仍为红灯 |
| 全局多项目 | ✅ 每工作区独立 `state.json` |

详情：[docs/traffic-lights-runtime.md](docs/traffic-lights-runtime.md)

---

## 性能与安全

- Hook 仅在 Agent 事件时启动 **Node 子进程**；无 Agent 时 **零额外占用**。
- 扩展只 **watch 当前工作区** 对应的一个 `state.json`，无轮询。
- 状态文件仅写在 `~/.cursor/ai-traffic-lights/states/` 下，按工作区 hash 分子目录。

---

## 开发者

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights && npm install && npm run build
npm run install:global-hooks
npm run install:cursor-extension:local   # 或 npm run package:extension
```

| 命令 | 作用 |
|------|------|
| `npm run install:global-hooks` | 安装用户目录 Hooks |
| `npm run uninstall:global-hooks` | 卸 Hooks + `~/.cursor/ai-traffic-lights/` |
| `npm run uninstall:cursor-extension` | 卸本机扩展目录 |
| `npm run package:extension` | 构建 VSIX（上传 Release，不提交 git） |
| `npm run build:desktop` | 构建 Mac `.dmg` / Windows `.exe`（Windows 需在 Windows 机构建） |

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/HANDOFF.md](docs/HANDOFF.md) | 进度、架构细节、待办 |
| [docs/desktop-app-status.md](docs/desktop-app-status.md) | 桌面 App 功能与已知问题 |
| [install/desktop/README.md](install/desktop/README.md) | Mac dmg 安装 / Windows 打 exe |
| [docs/distribution.md](docs/distribution.md) | 与本文互补的分发说明 |
| [docs/traffic-lights-runtime.md](docs/traffic-lights-runtime.md) | 运行时逻辑与版本说明 |

---

## 许可与贡献

VSIX / dmg 通过 **Releases** 分发，不提交进 git（见 `.gitignore`）。勿提交各项目 `.ai-traffic-lights/` 运行时文件。
