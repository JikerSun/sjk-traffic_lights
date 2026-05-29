# AI Traffic Lights

在 Cursor 侧边栏（及未来的桌面悬浮窗）用 **红 / 黄 / 绿** 三盏灯表示 AI Agent 状态：运行中、等待用户、已完成。

**仓库：** https://github.com/JikerSun/sjk-traffic_lights

---

## 我只想安装使用（不看源码）

请直接进入 **[`install/`](install/)** 目录。

**推荐（所有 Cursor 项目自动变灯，每台电脑装一次）：**

1. 扩展 → [`install/cursor/extension/`](install/cursor/extension/)（VSIX）
2. 全局 Hooks → [`install/cursor/global-hooks/`](install/cursor/global-hooks/)（`npm run install:global-hooks`）

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights && npm install
npm run install:global-hooks
npm run install:cursor-extension:local
```

Reload Window 后，用 Cursor 打开**任意项目文件夹**即可。

| 我要… | 去这里 |
|--------|--------|
| 全局 Hooks（推荐） | [`install/cursor/global-hooks/`](install/cursor/global-hooks/) |
| 侧边栏扩展 VSIX | [`install/cursor/extension/`](install/cursor/extension/) |
| 仅单个项目 Hooks（备用） | [`install/cursor/workspace-hooks/`](install/cursor/workspace-hooks/) |
| 桌面 App（预留） | [`install/desktop/`](install/desktop/) |

更细说明与**彻底卸载**：[docs/distribution.md](docs/distribution.md)

---

## 当前已实现的功能

| 能力 | 状态 | 说明 |
|------|------|------|
| 红灯 `RUNNING` | ✅ 稳定 | Agent 执行中 |
| 绿灯 `DONE` | ✅ 稳定 | `stop(completed)` 后约 1s 内变绿 |
| 红灯闪烁 `ERROR` | ✅ 稳定 | 异常 / 中止等 |
| 黄灯 `WAITING_USER` | ⚠️ 受限 | 依赖 Cursor `AskQuestion` 信号，常不可靠 |
| Plan 红黄闪 `WAITING_PLAN_BUILD` | ⚠️ 受限 | 依赖 Plan 模式信号，常不可靠 |
| 全局多项目 Hooks | ✅ | `~/.cursor/ai-traffic-lights/states/<id>/` |
| 手动调试命令 | ✅ | 命令面板 `AI Traffic Lights: Set …` |
| 桌面悬浮窗 | 🚧 脚手架 | `products/desktop-overlay/` |
| Codex / 其它 IDE | 🚧 预留 | `install/plugins/codex/` |

逻辑与限制详见 [docs/traffic-lights-runtime.md](docs/traffic-lights-runtime.md)。

---

## 仓库目录结构

```
sjk-traffic_lights/
├── install/
│   └── cursor/
│       ├── extension/          # VSIX
│       ├── global-hooks/       # ★ 用户目录一次安装（推荐）
│       └── workspace-hooks/    # 单项目备用
├── products/                   # 扩展、桌面 UI 源码
├── libs/                       # 状态机、协议、适配器
├── scripts/lib/                # Hook 共享逻辑（安装时复制到 ~/.cursor/ai-traffic-lights/lib）
├── tools/                      # install:global-hooks、卸载脚本等
└── docs/
```

---

## 开发者快速开始

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights
npm install
npm run build
npm run install:global-hooks          # 本机所有 Cursor 项目
npm run install:cursor-extension:local
```

| 命令 | 作用 |
|------|------|
| `npm run install:global-hooks` | 用户目录 Hooks（**推荐**） |
| `npm run uninstall:global-hooks` | 卸 Hooks + `~/.cursor/ai-traffic-lights/` |
| `npm run uninstall:cursor-extension` | 卸本机扩展目录 |
| `npm run install:cursor-extension:local` | 构建并安装扩展 |
| `npm run package:extension` | 生成 VSIX |
| `npm run bootstrap -- /path` | 备用：仅单项目 Hooks |

---

## 桥接文件

默认（全局安装后）：

`~/.cursor/ai-traffic-lights/states/<workspace-id>/state.json`

扩展按**当前打开的工作区**自动选对应文件。命令面板：**`AI Traffic Lights: Open Bridge State File`**。

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/distribution.md](docs/distribution.md) | 安装、卸载、性能 |
| [docs/traffic-lights-runtime.md](docs/traffic-lights-runtime.md) | 运行时逻辑 |
| [docs/architecture.md](docs/architecture.md) | 架构 |

---

## 许可与贡献

提交 PR 前勿提交 `.ai-traffic-lights/` 运行时、`*.vsix`（见 `.gitignore`）。
