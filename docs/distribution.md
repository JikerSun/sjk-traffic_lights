# 分发与安装（任意 Cursor 项目）

## 重要：两层安装

| 层级 | 装几次 | 作用 |
|------|--------|------|
| **A. Cursor 扩展** | 每台电脑 **1 次** | 侧边栏三盏灯（读 `state.json`） |
| **B. 项目 Hooks** | **每个仓库 1 次** | Agent 运行时自动写 `state.json` |

只装 A 不装 B → 灯不会随 AI 自动变。  
只装 B 不装 A → 可以改 `state.json`，但没有侧边栏 UI。

**不想翻源码：** 从仓库 [`install/`](../install/) 进入对应子目录即可。

---

## A. 扩展（本机一次）

### 方式 1：从 GitHub Release 装 VSIX（推荐给同事）

1. 在 [Releases](https://github.com/JikerSun/sjk-traffic_lights/releases) 下载 `ai-traffic-lights-cursor.vsix`
2. Cursor → `Cmd+Shift+P` → **Extensions: Install from VSIX...**
3. **Reload Window**

### 方式 2：从源码构建 VSIX

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights
npm install
npm run package:extension
```

安装 **`install/cursor/extension/ai-traffic-lights-cursor.vsix`**（步骤同方式 1）。

### 方式 3：本地开发安装

```bash
npm run install:cursor-extension:local
```

然后 Reload Window。

---

## B. 项目 Hooks（每个仓库一次，约 5 秒）

### 方式 1：只下载 Hooks 文件夹

使用仓库中的 **`install/cursor/workspace-hooks/`**（可单独拷贝或 sparse checkout）：

```bash
install/cursor/workspace-hooks/bootstrap.sh /path/to/your-project
```

### 方式 2：从完整仓库 bootstrap

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
/path/to/sjk-traffic_lights/tools/bootstrap-traffic-lights.sh /path/to/your-project
```

或在工具仓库根目录：

```bash
npm run bootstrap -- /path/to/your-project
```

会复制到目标项目：

- `.cursor/hooks.json`
- `.cursor/hooks/write-bridge-from-hook.mjs`
- `scripts/lib/*.mjs`
- `.ai-traffic-lights/state.json`（若不存在则创建）

修改本仓库 hooks 后，请执行 `npm run sync:install-kits` 以更新 `install/cursor/workspace-hooks/`。

然后用 **Cursor 打开目标项目根目录** → **Reload Window** → **Status Lights**。

---

## 快速检查清单

- [ ] 扩展已安装（命令面板能搜到 `AI Traffic Lights`）
- [ ] 当前窗口打开的是 **已 bootstrap 的那个文件夹**
- [ ] 已 Reload Window
- [ ] Agent 跑一轮后 `.ai-traffic-lights/state.json` 里 `state` 会变（如 `RUNNING` → `DONE`）

手动试灯：`Cmd+Shift+P` → `AI Traffic Lights: Set Running` / `Set Done`

---

## 已知能力边界

见 [`traffic-lights-runtime.md`](traffic-lights-runtime.md)：黄灯（AskQuestion）、Plan 等 Build 红黄闪依赖 Cursor 信号，当前以 **红 / 绿 / ERROR** 为主。

---

## 安全说明

- **不要**把 GitHub 密码交给他人或 AI。
- 用 [GitHub CLI](https://cli.github.com/) `gh auth login`，或 **SSH / Personal Access Token** 推送代码。
