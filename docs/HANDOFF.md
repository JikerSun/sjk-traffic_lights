# 项目接续文档（扫描此文件即可继续）

> **最后更新：** 2026-05-29  
> **仓库：** https://github.com/JikerSun/sjk-traffic_lights  
> **分支：** `main`

下次会话优先读：**本文 → [`traffic-lights-runtime.md`](traffic-lights-runtime.md) → [`distribution.md`](distribution.md)**

---

## 1. 项目是什么

在 **Cursor 侧边栏**（未来还有桌面悬浮窗）用三盏灯表示 Agent 状态：

| 状态 | 灯 | 稳定性 |
|------|-----|--------|
| `RUNNING` | 红灯常亮 | ✅ 可用 |
| `DONE` | 绿灯常亮 | ✅ 可用（`stop(completed)` 后变绿，非最后一个 token） |
| `ERROR` | 红灯闪烁 | ✅ 可用 |
| `WAITING_USER` | 黄灯闪烁 | ⚠️ Cursor 信号不足，多数场景仍红灯 |
| `WAITING_PLAN_BUILD` | 红黄交替 | ⚠️ Plan 阶段 Hook 难 latch，多数仍红灯 |
| `IDLE` | 全灭 | ✅ |

扩展版本：**0.1.4**（`products/cursor-extension/package.json`）  
UI 面板相对设计稿约 **54%**（75%×80%×90%，见 `sidebarProvider.ts` / `desktop-overlay/index.html`）。

---

## 2. 总体架构（数据流）

```
Cursor Agent 事件
    ↓
~/.cursor/hooks.json  →  node write-bridge-from-hook.mjs <event>
    ↓
scripts/lib/bridge-resolve.mjs        （事件 → 状态）
scripts/lib/cursor-transcript-state.mjs （Ask / transcript）
scripts/lib/plan-session.mjs           （Plan 上下文）
    ↓
~/.cursor/ai-traffic-lights/states/<workspaceId>/state.json
    ↓
扩展 products/cursor-extension（fs.watch 读 state.json）→ 侧边栏 Webview 三盏灯
```

**关键：** 每个「工作区根目录」一个 `workspaceId`（`sha256(绝对路径)` 前 16 位），避免多项目串灯。

---

## 3. 安装方式（当前推荐）

| 步骤 | 命令 / 位置 | 次数 |
|------|-------------|------|
| 全局 Hooks | `npm run install:global-hooks` | 每台 Mac **1 次** |
| 侧边栏扩展 | VSIX 或 `npm run install:cursor-extension:local` | 每台 Mac **1 次** |
| Reload | Cursor **Reload Window** | 每次装完后 |

状态文件示例：

`~/.cursor/ai-traffic-lights/states/6b02e7d5dca5f428/state.json`  
（`6b02e7d5…` = `/Users/.../sjk-traffic_lights` 的 hash）

**不要**再依赖「每个项目 bootstrap」作为默认路径；备用见 `install/cursor/workspace-hooks/`。

### 彻底卸载

```bash
npm run uninstall:global-hooks
npm run uninstall:cursor-extension
# 或 Cursor Extensions 里卸载 AI Traffic Lights
```

详见 [`distribution.md`](distribution.md)。

---

## 4. 全局 Hook 重要逻辑（2026-05-29 已修）

### 4.1 Cursor 行为

| Hook 配置位置 | 脚本 `cwd` | 项目路径从哪来 |
|---------------|------------|----------------|
| 项目 `.cursor/hooks.json` | **项目根** | `process.cwd()` 即可 |
| 用户 `~/.cursor/hooks.json` | **`~/.cursor`** | **必须用 `payload.workspace_roots[0]`** |

官方：[Cursor Hooks 文档](https://cursor.com/docs/hooks) — 用户级命令路径应相对 `~/.cursor/`，例如：

`node ./ai-traffic-lights/hooks/write-bridge-from-hook.mjs beforeSubmitPrompt`

### 4.2 代码入口

| 文件 | 作用 |
|------|------|
| [`scripts/lib/bridge-paths.mjs`](../scripts/lib/bridge-paths.mjs) | `resolveProjectRootFromHook()`、`resolveBridgePath()`、全局目录 |
| [`.cursor/hooks/write-bridge-from-hook.mjs`](../.cursor/hooks/write-bridge-from-hook.mjs) | Hook 主逻辑（仓库内副本） |
| `~/.cursor/ai-traffic-lights/hooks/write-bridge-from-hook.mjs` | 安装后的全局副本 |
| [`products/cursor-extension/src/bridgePaths.ts`](../products/cursor-extension/src/bridgePaths.ts) | 扩展解析同一 `workspaceId` 路径 |
| [`products/cursor-extension/src/extension.ts`](../products/cursor-extension/src/extension.ts) | `fs.watch` 监听 global state（工作区外文件） |
| [`tools/merge-user-hooks.mjs`](../tools/merge-user-hooks.mjs) | install / uninstall 合并 `hooks.json` |

### 4.3 防双跑

若已装全局 Hook，**项目内** `.cursor/hooks/write-bridge-from-hook.mjs` 检测到 `~/.cursor/ai-traffic-lights/install-manifest.json` 后会 **立即 exit**，避免 bootstrap + 全局各跑一遍。

### 4.4 曾出现的 Bug（已修）

- **症状：** 灯完全不随 Agent 变化。  
- **原因：** 全局 Hook 把状态写到 `workspaceId(～/.cursor)`，扩展读的是 `workspaceId(项目路径)`。  
- **修复：** `resolveProjectRootFromHook()` 使用 `workspace_roots[0]`。提交：`196c1b6`。

自检：`state.json` 里 `workspaceRoot` 必须是当前项目路径，不能是 `/Users/.../.cursor`。

---

## 5. 目录结构（2026-05-29 重组后）

```
sjk-traffic_lights/
├── install/                    # 给用户：VSIX、global-hooks 说明、workspace-hooks 备用
├── products/
│   ├── cursor-extension/       # 侧边栏扩展（主交付）
│   └── desktop-overlay/        # 桌面 Web 脚手架（未打包）
├── libs/                       # core / protocol / adapters
├── scripts/lib/                # Hook 共享库（安装时复制到 ~/.cursor/ai-traffic-lights/lib）
├── tools/                      # install-global-hooks、bootstrap、debug、merge-user-hooks
├── .cursor/hooks.json          # 本仓库开发用（与全局二选一逻辑上并存，有防双跑）
└── docs/
    ├── HANDOFF.md              # ← 本文件
    ├── traffic-lights-runtime.md
    └── distribution.md
```

---

## 6. 状态机与性能（精简）

- **写盘策略：** `shouldHookWriteBridge` 抑制重复的 `preToolUse`/`postToolUse` → `RUNNING`。  
- **不启用：** `afterAgentThought`、MCP hooks（高频、无收益）。  
- **扩展不启：** 内嵌 watcher、250ms 轮询（v4.7 已删）。  
- **可选：** `npm run bridge:watch` 手动 transcript 监视。  
- **v4.5：** 去掉 `afterAgentResponse` 后「静默→黄灯」，避免先黄后绿。  
- **v4.6：** `stop(completed)` 恒 `DONE`，不在 completed 时扫 `~/.cursor/plans/*.plan.md`。

完整表见 [`traffic-lights-runtime.md`](traffic-lights-runtime.md)。

---

## 7. 用户实测结论（摘要）

| 场景 | 结果 |
|------|------|
| 红 / 绿 / ERROR | 用户验证 OK |
| AskQuestion 黄灯 | 面板期间多仍为红；Continue 后行为未稳定测完 |
| Plan 四阶段 A/C/D | 大致 OK |
| Plan 阶段 B（等 Build） | **失败**：常只有 RUNNING 或误绿，未红黄闪 |
| `debug:set:plan` 手动命令 | UI 正常 → 问题在 Hook 未 latch，非 UI |
| 全局 Hook 路径错误 | 已修（见 §4.4） |

**未做代码改动前约定：** 用户未明确说「修 Plan 灯」时，不要加激进 Plan/黄灯启发式（易回归 v4.5/v4.6 问题）。

---

## 8. 常用命令

```bash
npm install
npm run build
npm run install:global-hooks
npm run install:cursor-extension:local
npm run package:extension              # → install/cursor/extension/*.vsix
npm run sync:install-kits              # 刷新 install/cursor/workspace-hooks
npm run debug:set:running|done|plan|…  # 手动改 bridge
npm run bridge:watch                   # 可选
```

调试扩展：`.vscode/launch.json` → **Run AI Traffic Lights Extension**。

---

## 9. 待办优先级（产品）

1. **验证全局 Hook 修复后** 多项目、多文件夹打开是否都变灯。  
2. **桌面 overlay**（`products/desktop-overlay`）— 同一 bridge，浮窗 UI。  
3. **Plan 灯** — 仅当用户要求「修 Plan 灯」再动 `plan-session.mjs` / hook。  
4. **Codex adapter** — `libs/adapters`，overlay 稳定后。  
5. **GitHub Releases** — 上传 VSIX，减少同事 clone 构建。

---

## 10. 文档索引

| 文档 | 用途 |
|------|------|
| **HANDOFF.md**（本文件） | 进度 + 逻辑 + 接续 |
| [traffic-lights-runtime.md](traffic-lights-runtime.md) | 运行时细节、限制、版本 |
| [distribution.md](distribution.md) | 安装 / 卸载 / 检查清单 |
| [architecture.md](architecture.md) | 模块边界 |
| [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md) | 长期计划、历史测试记录 §9–11 |
| [README.md](../README.md) | 对外入口 |

---

## 11. 仓库外 / 不提交

- Cursor Skill **`push-sjk-traffic-lights`**：仅在 `~/.cursor/skills/`（`.gitignore` 了 `.cursor/skills/`），用于 push GitHub。  
- 运行时：`~/.cursor/ai-traffic-lights/`、各项目 `.ai-traffic-lights/`（若曾 bootstrap）。

---

## 12. 变更日志（接续用）

| 日期 | 提交主题 | 说明 |
|------|----------|------|
| 2026-05-29 | 初始上 GitHub | `JikerSun/sjk-traffic_lights` |
| 2026-05-29 | `install/` 目录重组 | products / libs / tools |
| 2026-05-29 | UI 缩小 | 面板约 54%，commit 备注「充值UI大小」 |
| 2026-05-29 | 全局 Hooks | `install:global-hooks`，per-workspace state |
| 2026-05-29 | **fix workspace_roots** | 全局 Hook 灯不亮根因修复 |

---

*维护：有重大架构或测试结果变更时，更新本节与 §7，并改文首日期。*
