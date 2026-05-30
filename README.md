# AI Traffic Lights

在 Cursor 侧边栏（及未来的桌面悬浮窗）用 **红 / 黄 / 绿** 三盏灯表示 AI Agent 状态：运行中、等待用户、已完成。

**仓库：** https://github.com/JikerSun/sjk-traffic_lights  
**最新扩展包：** [GitHub Releases](https://github.com/JikerSun/sjk-traffic_lights/releases)（`ai-traffic-lights-cursor.vsix`）

---

## 安装（推荐：Release + 全局 Hook）

**每台 Mac 做两次（扩展 + Hooks），之后任意 Cursor 项目都能自动变灯。**

### 1. 安装侧边栏扩展（VSIX）

1. 打开 **[Releases](https://github.com/JikerSun/sjk-traffic_lights/releases)**，下载最新 **`ai-traffic-lights-cursor.vsix`**
2. Cursor → `Cmd+Shift+P` → **Extensions: Install from VSIX...** → 选择该文件
3. 安装完成后先 **Reload Window**（最后与 Hook 一起 Reload 也可）

> 若已装过旧版，可先卸载 **AI Traffic Lights** 再装新 VSIX。

### 2. 安装全局 Hooks（所有项目自动写状态）

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights
npm install
npm run install:global-hooks
```

会写入 `~/.cursor/hooks.json` 与 `~/.cursor/ai-traffic-lights/`（按工作区隔离的 `state.json`）。

### 3. 使用

1. **Reload Window**
2. 用 Cursor 打开**任意项目根目录**
3. 打开视图 **Status Lights**（或命令面板 `AI Traffic Lights: Show Status Lights`）
4. 跑一轮 Agent，红灯 → 绿灯应随状态变化

状态文件路径：`~/.cursor/ai-traffic-lights/states/<workspace-id>/state.json`

### 卸载

```bash
cd sjk-traffic_lights   # 已 clone 的目录
npm run uninstall:global-hooks
npm run uninstall:cursor-extension
```

或在 Cursor **Extensions** 里卸载 **AI Traffic Lights**，再 Reload。详见 [docs/distribution.md](docs/distribution.md)。

---

## 其它安装方式

| 方式 | 适用 |
|------|------|
| [Releases VSIX](https://github.com/JikerSun/sjk-traffic_lights/releases) + 上表 Hook | **推荐给同事** |
| `npm run install:cursor-extension:local` | 本机从源码装扩展（开发者） |
| `npm run package:extension` | 本地打 VSIX → `install/cursor/extension/` |
| `install/cursor/workspace-hooks/bootstrap.sh` | 备用：仅单个项目 Hook（不推荐） |

目录说明见 **[`install/`](install/)**；接续开发读 **[`docs/HANDOFF.md`](docs/HANDOFF.md)**。

---

## 当前已实现的功能

| 能力 | 状态 | 说明 |
|------|------|------|
| 红灯 `RUNNING` | ✅ 稳定 | Agent 执行中 |
| 绿灯 `DONE` | ✅ 稳定 | `stop(completed)` 后变绿 |
| 红灯闪烁 `ERROR` | ✅ 稳定 | 异常 / 中止等 |
| 黄灯 `WAITING_USER` | ⚠️ 受限 | AskQuestion 信号常不可靠 |
| Plan 红黄闪 `WAITING_PLAN_BUILD` | ⚠️ 受限 | Plan Hook 难 latch |
| 全局多项目 Hooks | ✅ | `~/.cursor/ai-traffic-lights/states/<id>/` |
| 手动调试命令 | ✅ | `AI Traffic Lights: Set …` |
| 桌面悬浮窗 | 🚧 脚手架 | `products/desktop-overlay/` |

逻辑与限制：[docs/traffic-lights-runtime.md](docs/traffic-lights-runtime.md)

---

## 仓库目录结构

```
sjk-traffic_lights/
├── install/cursor/
│   ├── extension/       # 本地 build 的 VSIX 输出目录
│   └── global-hooks/    # 全局 Hook 说明
├── products/cursor-extension/
├── scripts/lib/         # Hook 逻辑（安装时复制到 ~/.cursor/ai-traffic-lights/lib）
├── tools/               # install:global-hooks、package:extension 等
└── docs/
```

---

## 开发者

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights && npm install && npm run build
npm run install:global-hooks
npm run install:cursor-extension:local
# 或发版：npm run package:extension
```

| 命令 | 作用 |
|------|------|
| `npm run package:extension` | 生成 VSIX → `install/cursor/extension/` |
| `npm run install:global-hooks` | 用户目录 Hooks |
| `npm run uninstall:global-hooks` | 卸 Hooks + 桥接数据 |

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/HANDOFF.md](docs/HANDOFF.md) | 进度、逻辑、待办 |
| [docs/distribution.md](docs/distribution.md) | 安装 / 卸载详情 |
| [docs/traffic-lights-runtime.md](docs/traffic-lights-runtime.md) | 运行时与限制 |

---

## 许可与贡献

勿将 `.ai-traffic-lights/` 运行时、`*.vsix` 提交进 git（见 `.gitignore`）；VSIX 通过 **Releases** 分发。
