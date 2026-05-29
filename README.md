# AI Traffic Lights

在 Cursor 侧边栏（及未来的桌面悬浮窗）用 **红 / 黄 / 绿** 三盏灯表示 AI Agent 状态：运行中、等待用户、已完成。

**仓库：** https://github.com/JikerSun/sjk-traffic_lights

---

## 我只想安装使用（不看源码）

请直接进入 **[`install/`](install/)** 目录，按工具选择子文件夹：

| 我要… | 去这里 |
|--------|--------|
| 装 Cursor 侧边栏扩展 | [`install/cursor/extension/`](install/cursor/extension/) |
| 给某个项目接上自动变灯（Hooks） | [`install/cursor/workspace-hooks/`](install/cursor/workspace-hooks/) |
| 以后下 macOS / Windows 桌面 App | [`install/desktop/mac/`](install/desktop/mac/) · [`install/desktop/windows/`](install/desktop/windows/) |
| 以后下其它 IDE 插件 | [`install/plugins/`](install/plugins/) |

**完整两步（Cursor）：**

1. 安装 **VSIX 扩展**（每台电脑一次）→ 见上表 `extension`
2. 对目标项目运行 **`workspace-hooks/bootstrap.sh`**（每个仓库一次）→ 见上表 `workspace-hooks`

然后：Cursor 打开该项目根目录 → **Reload Window** → 打开视图 **Status Lights**。

更细的说明：[docs/distribution.md](docs/distribution.md)

---

## 当前已实现的功能

| 能力 | 状态 | 说明 |
|------|------|------|
| 红灯 `RUNNING` | ✅ 稳定 | Agent 执行中 |
| 绿灯 `DONE` | ✅ 稳定 | `stop(completed)` 后约 1s 内变绿 |
| 红灯闪烁 `ERROR` | ✅ 稳定 | 异常 / 中止等 |
| 黄灯 `WAITING_USER` | ⚠️ 受限 | 依赖 Cursor `AskQuestion` 信号，常不可靠 |
| Plan 红黄闪 `WAITING_PLAN_BUILD` | ⚠️ 受限 | 依赖 Plan 模式信号，常不可靠 |
| 手动调试命令 | ✅ | 命令面板 `AI Traffic Lights: Set …` |
| 桌面悬浮窗 | 🚧 脚手架 | 源码在 `products/desktop-overlay/`，安装包目录预留 |
| Codex / 其它 IDE | 🚧 预留 | `install/plugins/codex/`、`libs/adapters/` |

逻辑与限制详见 [docs/traffic-lights-runtime.md](docs/traffic-lights-runtime.md)。

---

## 仓库目录结构

```
sjk-traffic_lights/
├── install/                 # ★ 给最终用户：按工具/平台分的安装包与说明
│   ├── cursor/
│   │   ├── extension/       # VSIX 输出目录（npm run package:extension）
│   │   └── workspace-hooks/ # 可单独下载的 Hooks 套件 + bootstrap.sh
│   ├── desktop/
│   │   ├── mac/             # 预留：macOS 安装包
│   │   └── windows/         # 预留：Windows 安装包
│   └── plugins/             # 预留：各 IDE/编译器插件汇总
│       └── codex/
│
├── products/                # 可运行的 UI 产品（源码）
│   ├── cursor-extension/    # Cursor 扩展
│   └── desktop-overlay/     # 桌面 Web / Tauri 轨道
│
├── libs/                    # 共享库（状态机、协议、适配器）
│   ├── core/
│   ├── protocol/
│   └── adapters/
│
├── scripts/lib/             # Hooks 运行时依赖（bootstrap 会复制到用户项目的 scripts/lib）
├── tools/                   # 构建、安装、调试、同步 install 套件
├── .cursor/                 # 本仓库 Cursor Hooks 配置（开发用）
├── docs/                    # 架构、运行时、调试文档
└── image/                   # 灯图与面板资源（若有）
```

### 各目录职责简述

| 目录 | 谁用 | 作用 |
|------|------|------|
| `install/` | 使用者 | 下载即用：VSIX、Hooks 包、未来 dmg/exe/各渠道插件 |
| `products/` | 开发者 | 扩展与桌面 UI 源码 |
| `libs/` | 开发者 | 状态机与多工具适配器 |
| `scripts/lib/` | Hooks | 桥接状态解析；复制到用户项目的 `scripts/lib/` |
| `tools/` | 开发者 / CI | `bootstrap`、`package:extension`、`sync:install-kits` 等 |
| `.cursor/` | 本仓库 | `hooks.json` 驱动本项目的 `state.json` |
| `docs/` | 所有人 | 分发、架构、运行时说明 |

---

## 开发者快速开始

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights
npm install
npm run build
```

| 命令 | 作用 |
|------|------|
| `npm run bootstrap -- /path/to/project` | 给其它项目安装 Hooks |
| `npm run install:cursor-extension:local` | 本机构建并安装扩展 |
| `npm run package:extension` | 生成 VSIX → `install/cursor/extension/` |
| `npm run sync:install-kits` | 用最新 hooks 刷新 `install/cursor/workspace-hooks/` |
| `npm run bridge:watch` | 可选：额外监视 transcript（默认不启） |

扩展开发调试：VS Code/Cursor 启动配置 `Run AI Traffic Lights Extension`（见 `.vscode/launch.json`）。

---

## 桥接文件

扩展与 Hooks 通过工作区内的文件通信：

- **`.ai-traffic-lights/state.json`** — 当前灯状态（JSON）
- 命令面板：**`AI Traffic Lights: Open Bridge State File`**

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/distribution.md](docs/distribution.md) | 安装步骤与检查清单 |
| [docs/traffic-lights-runtime.md](docs/traffic-lights-runtime.md) | 运行时逻辑与已知限制 |
| [docs/architecture.md](docs/architecture.md) | 架构与模块边界 |
| [docs/cursor-sidebar-quickstart.md](docs/cursor-sidebar-quickstart.md) | 侧边栏快速上手 |
| [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) | 长期开发计划 |

---

## 许可与贡献

当前为个人/团队工具仓库。提交 PR 前请避免把 `.ai-traffic-lights/` 运行时文件、`*.vsix` 纳入提交（见 `.gitignore`）。
