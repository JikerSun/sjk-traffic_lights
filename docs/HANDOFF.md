# 项目接续文档（扫描此文件即可继续）

> **最后更新：** 2026-05-30（扩展 v0.1.6 · 桌面 v0.1.2 · Multi Agent · **监听阶段告一段落**）  
> **仓库：** https://github.com/JikerSun/sjk-traffic_lights  
> **分支：** `main`  
> **对外 README：** [中文](../README.md) · [English](../README.en.md)

下次会话优先读：**本文 §0–§9 → [`desktop-app-status.md`](desktop-app-status.md) → [`traffic-lights-runtime.md`](traffic-lights-runtime.md) → [`multi-agent-design.md`](multi-agent-design.md)（已实现，改 Multi 时对照）→ [`distribution.md`](distribution.md)**

---

## 0. 当前阶段（2026-05-30）

> **Cursor 单 / 多 Agent 监听（Hook → bridge → 扩展 / 桌面 UI）本阶段告一段落。** Mac 侧边栏 v0.1.6、桌面浮窗 v0.1.2 均已 Release 且实测通过；后续迭代见 §9，**未明确要求前勿动 Plan / 黄灯启发式**。

| 里程碑 | 状态 | 说明 |
|--------|------|------|
| **Phase 2 — Cursor 单 / 多 Agent 监听** | ✅ **告一段落** | Hook + `state.json` bridge · Single 回归 + Multi 计数 · 扩展 v0.1.6 + 桌面 v0.1.2 |
| **Phase 2 — Cursor 侧边栏（Mac）** | ✅ **v0.1.6 已发** | [v0.1.6](https://github.com/JikerSun/sjk-traffic_lights/releases/tag/v0.1.6) |
| **Phase 2 — Windows VSIX** | 🧪 **待测** | 同事按 README 装 v0.1.6 + `install:global-hooks`（或仅桌面 App 自动 Hook） |
| **Phase 3 — 桌面悬浮窗（Mac）** | ✅ **v0.1.2 已发** | Multi Agent 浮窗 · [desktop-v0.1.2](https://github.com/JikerSun/sjk-traffic_lights/releases/tag/desktop-v0.1.2) |
| **Phase 3.1 — 菜单 + Preferences** | ✅ | Settings 子菜单；Preferences 卸载步骤弹窗 |
| **Phase 3 — Windows 桌面** | 🔴 **未就绪** | `platform_windows.rs` stub；需在 Windows 上 build exe |
| **Phase 5 — 手机同步红绿灯** | 📋 **暂缓** | 见 [mobile-sync-plan.md](mobile-sync-plan.md) |
| 黄灯 / Plan 红黄闪 | ⏸ **冻结** | Cursor Hook 信号不足；用户未说「修 Plan 灯」不改 |
| 多 Agent | ✅ **已实施** | [multi-agent-design.md](multi-agent-design.md) · 共享 core：`libs/protocol` + `libs/core` |

**桌面 App 接续（功能 + 问题）：** [`docs/desktop-app-status.md`](desktop-app-status.md)

**扩展稳定版：** **0.1.6** · https://github.com/JikerSun/sjk-traffic_lights/releases/tag/v0.1.6

**桌面包：** 标签 **`desktop-v0.1.2`** · 构建 / 发版 pitfalls 见 [`desktop-app-status.md`](desktop-app-status.md) **§3、§7** · 用户安装见 [install/desktop/README.md](../install/desktop/README.md)

---

## 1. 项目是什么

在 **Cursor 侧边栏** 与 **Mac 桌面浮窗** 用三盏灯表示 Agent 状态：

| 状态 | 灯 | 稳定性 |
|------|-----|--------|
| `RUNNING` | 红灯常亮 | ✅ 可用 |
| `DONE` | 绿灯常亮 | ✅ 可用（`stop(completed)` 后变绿，非最后一个 token） |
| `ERROR` | 红灯闪烁 | ✅ 可用 |
| `WAITING_USER` | 黄灯闪烁 | ⚠️ Cursor 信号不足，多数场景仍红灯 |
| `WAITING_PLAN_BUILD` | 红黄交替 | ⚠️ Plan 阶段 Hook 难 latch，多数仍红灯 |
| `IDLE` | 全灭 | ✅ |

扩展版本：**0.1.6**（`products/cursor-extension/package.json`）  
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
扩展 products/cursor-extension 或 桌面 products/desktop-overlay（fs.watch）→ 三盏灯 UI
```

**关键：** 每个「工作区根目录」一个 `workspaceId`（`sha256(绝对路径)` 前 16 位），避免多项目串灯。

---

## 3. 安装方式（当前推荐）

| 步骤 | 命令 / 位置 | 次数 |
|------|-------------|------|
| 全局 Hooks | `npm run install:global-hooks` | 每台电脑 **1 次** |
| 侧边栏扩展 | VSIX 或 `npm run install:cursor-extension:local` | 每台电脑 **1 次** |
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
│   └── desktop-overlay/        # Tauri 桌面 App（Mac dmg 可测）
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

## 9. 待办优先级（下一阶段迭代）

**本阶段已完成（勿重复立项）：** 单 Agent 监听 · Multi Agent 计数 · Mac 扩展 v0.1.6 · Mac 桌面 v0.1.2 · 全局 Hook 安装/卸载 · 桌面 App 首启自动 Hook。

**近期（按优先级）**

1. **Windows VSIX 同事实测** — v0.1.6；文档 [README.md](../README.md) / [README.en.md](../README.en.md)
2. **Windows 桌面 App** — 补 `platform_windows.rs` + Windows 机 `npm run build:desktop` → `.exe`（[install/desktop/README.md](../install/desktop/README.md) §C）
3. **Mac 分发体验** — Developer ID 签名 + 公证（减少 `xattr`）；或维持文档引导
4. **内置 Node** — 打进 App `resources/node/`，减少 Hook 安装对系统 Node 依赖
5. **桌面 App polish** — 菜单 Uninstall 与 Preferences 一致；Intel Mac x64 dmg / CI（可选）

**冻结 / 仅用户明确要求时**

6. **Plan 灯 / 黄灯** — 仅当用户说 **「修 Plan 灯」** 再动 `scripts/lib/`（见 §7）
7. **Phase 5 手机同步** — 📋 暂缓；[mobile-sync-plan.md](mobile-sync-plan.md)
8. **Codex IDE 支持** — 后期；[desktop-app-requirements.md](desktop-app-requirements.md)
9. **Multi Agent 微调** — 对照 [multi-agent-design.md](multi-agent-design.md) §8 回归；改 Hook 后 `sync:hook-kit` + 扩展/桌面 rebuild

**调试 Multi Agent：** `npm run debug:multi:clear` · `npm run debug:multi:inspect`

---

## 9.1 桌面 App 产品决策（2026-05-29 · 已锁定）

| # | 决策 |
|---|------|
| Q1 | **B** — 拖动后自由位置；「恢复吸附」再跟窗 |
| Q2 | 检测 Node≥20；有 → 系统 `node`；无 → App 内置 Node |
| Q3 | 卸载 App 同步卸 Hook；`hooks.json` 无其它内容则删整文件 |
| Q4 | 首启 1 窗自动 / 多窗弹选；设置下拉；低频检测窗口变化后再弹选 |
| Q5 | **Mac + Windows 同代码**；不行则 Mac 先、Windows 后 |
| Q6 | **占满屏 = 全屏**（含最大化）；浮窗 **always-on-top**（系统级弹窗除外） |
| — | Cursor **退出** → **hide**；**无跟窗位置 loop**（仅触发式一次吸附，见 desktop-app-requirements §1.2） |

全文：[desktop-app-requirements.md](desktop-app-requirements.md)

---

## 10. 文档索引

| 文档 | 用途 |
|------|------|
| **HANDOFF.md**（本文件） | 进度 + 逻辑 + 接续 |
| [traffic-lights-runtime.md](traffic-lights-runtime.md) | 运行时细节、限制、版本 |
| [distribution.md](distribution.md) | 安装 / 卸载 / 检查清单 |
| [desktop-app-status.md](desktop-app-status.md) | **桌面 App 实现 + 已知问题（接续必读）** |
| [desktop-app-requirements.md](desktop-app-requirements.md) | 桌面 App 需求 + 多 Agent 备忘 |
| [desktop-app-testing-mac.md](desktop-app-testing-mac.md) | Mac 桌面 App 测试步骤 |
| [mobile-sync-plan.md](mobile-sync-plan.md) | **Phase 5 手机同步（暂缓）** |
| [multi-agent-design.md](multi-agent-design.md) | **Phase 3.x 多 Agent 设计** |
| [install/desktop/README.md](../install/desktop/README.md) | **Mac dmg 安装 / 发 Release / Windows 打 exe** |
| [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md) | 长期计划、历史测试记录 §9–11 |
| [README.md](../README.md) | 对外入口（中文） |
| [README.en.md](../README.en.md) | 对外入口（English） |

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
| 2026-05-29 | UI 缩小 | 面板约 54% |
| 2026-05-29 | 全局 Hooks | `install:global-hooks`，per-workspace state |
| 2026-05-29 | **fix workspace_roots** | 全局 Hook 灯不亮根因修复 |
| 2026-05-29 | **v0.1.5 Release** | VSIX 打包含 `resources/image/`；README 安装/卸载完善 |
| 2026-05-30 | **desktop-v0.1.1** | Finder 启动修复；安装文档 `xattr`；Mac 分发 pitfalls 文档 |
| 2026-05-30 | **v0.1.6 + desktop-v0.1.2** | Multi Agent（Hook + 扩展 + 桌面浮窗）；VSIX / dmg Release |
| 2026-05-30 | **监听阶段告一段落** | 文档：README 中/英 · HANDOFF §9 下一阶段待办 |
| 2026-05-30 | **Phase 3.x 多 Agent 设计** | [multi-agent-design.md](multi-agent-design.md) 规格：Single 回归 + Multi 计数 + 性能/内存上界 |
| 2026-05-30 | **Phase 5 立项暂缓** | 手机同步方案写入 [mobile-sync-plan.md](mobile-sync-plan.md) |
| 2026-05-29 | **Phase 3.1 菜单栏** | 窗口/恢复吸附进菜单；浮窗去掉 ⌖；设置仅 Hook |
| 2026-05-29 | **吸附改为触发式** | 取消跟窗 loop；仅启动/恢复吸附时读 bounds |

---

*维护：有重大架构或测试结果变更时，更新本节与 §7，并改文首日期。*
