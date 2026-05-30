# Codex 适配规格（Phase 3.x）

> **状态：** 🚧 Phase 0 进行中（侦察 Hook + bridge 脚手架）  
> **用户环境：** Codex **桌面 App**（`com.openai.codex`）· macOS 已安装  
> **约束：** **不改动**已验收的 Cursor 路径与行为（`~/.cursor/…` · `products/cursor-extension/`）

**接续：** [HANDOFF.md](HANDOFF.md) · [codex-onboarding.md](codex-onboarding.md) · [multi-agent-design.md](multi-agent-design.md)

---

## 1. 产品决策（2026-05-30 已确认）

| # | 决策 |
|---|------|
| 灯义 | 与 Cursor 一致：**红**=AI 工作中 · **黄闪**=需用户确认 · **绿**=完成 · **红闪**=报错 `ERROR` |
| Multi | 与 Cursor 相同 Single / Multi 计数（共享 `libs/core` + `multi-agent-bridge.mjs`） |
| Codex UI | **IDE 侧边栏扩展**（VS Code 系 API，独立 VSIX） |
| Codex App | **无第三方 VSIX 面板**（官方 App 为独立 Electron，非 Cursor/VS Code fork）→ App 用户主 UI = **现有桌面浮窗** + Setup 选 Codex |
| 桌面浮窗 | **不新做 App**；`target_ide=codex` 读 Codex bridge、后续补 Codex 窗口枚举 |
| 平台 | **macOS + Windows**（与 Cursor 一致） |
| Cursor 隔离 | Codex bridge 根目录 **`~/.codex/ai-traffic-lights/`**，Hooks 写 **`~/.codex/hooks.json`** |
| 黄灯 | Codex `PermissionRequest` → 初步映射 `WAITING_USER`；**准确度待实测** |
| Plan 灯 | 暂 **冻结**（与 Cursor 相同，除非用户明确要求） |

### 1.1 UI 策略（为何两种壳）

| 使用场景 | 三盏灯展示 |
|----------|------------|
| **Codex App**（你的情况） | 桌面浮窗 App（选 Target IDE = Codex） |
| **VS Code / 其它编辑器 + Codex 扩展** | `products/codex-extension` 侧边栏 VSIX |
| 两者可并存 | 各读各的 bridge；桌面 App 只跟当前选的 IDE |

---

## 2. 架构

```
Codex Hook 事件 (stdin JSON, hook_event_name)
  → ~/.codex/ai-traffic-lights/hooks/write-bridge-from-codex-hook.mjs
  → scripts/lib/codex-bridge-resolve.mjs
  → scripts/lib/multi-agent-bridge.mjs + commit-bridge.mjs  (tool=codex)
  → ~/.codex/ai-traffic-lights/states/<workspaceId>/state.json
  → codex-extension (VSIX) 或 desktop-overlay (target_ide=codex) fs.watch
  → libs/core getMultiLightRenderState → 三盏灯 UI
```

**Cursor 路径不变：**

```
~/.cursor/hooks.json → ~/.cursor/ai-traffic-lights/states/…
```

---

## 3. Codex Hook 事件 → 状态（初稿 · 待 recon 校正）

| Codex 事件 | 初步 state | 说明 |
|------------|------------|------|
| `UserPromptSubmit` | `RUNNING` | 用户提交 |
| `PreToolUse` / `PostToolUse` | `RUNNING` | 工具执行 |
| `PermissionRequest` | **`WAITING_USER`** | 待审批 → 黄闪（**待测**） |
| `Stop` | `DONE` | 回合结束 |
| `SubagentStart` | Multi：`RUNNING` | `agent_id` 入 agents map |
| `SubagentStop` | `DONE`（该 agent） | |
| `SessionStart` | `IDLE` 或忽略 | 视 `source` 而定 |
| **报错** | **`ERROR`（红闪）** | ⚠️ 官方 Hook 表无独立 error 事件；见 §5 |

**Multi agent 键：**

- `conversationIdFrom` ← `session_id`（Codex 公共字段）
- `agentIdFrom` ← `session_id` 或 `session_id::agent_id`（Subagent）

---

## 4. 目录与命令（Phase 0 起）

| 路径 | 作用 |
|------|------|
| `scripts/lib/codex-bridge-paths.mjs` | `~/.codex/ai-traffic-lights/` |
| `scripts/lib/codex-bridge-resolve.mjs` | 事件 → state |
| `scripts/lib/codex-hook-recon.mjs` | 侦察 log |
| `scripts/codex/hooks/write-bridge-from-codex-hook.mjs` | Hook 入口（stdin） |
| `tools/merge-codex-hooks.mjs` | 安装 / 卸载 `~/.codex/hooks.json` |
| `products/codex-extension/` | Codex 侧边栏 VSIX（独立于 cursor-extension） |
| `install/plugins/codex/` | 用户安装包与说明 |

```bash
# Phase 0：只装侦察 Hook（写 log，不改灯）
npm run install:codex-recon-hooks

# Phase 1+：正式 bridge Hook
npm run install:codex-hooks
npm run uninstall:codex-hooks
```

侦察 log 目录：`~/.codex/ai-traffic-lights/recon/<date>/`

---

## 5. 待你实测 / 后期逐项核对清单

> 你提到「可能没想到的点」——先记录，实现过程中逐个勾掉。

- [ ] **Hook 信任**：Codex App / CLI 内 `/hooks` Review & Trust 我们的 Hook
- [ ] **PermissionRequest → 黄闪** 是否与 UI 一致
- [ ] **ERROR / 红闪**：从哪条 Hook / `tool_response` 判定失败（recon 重点）
- [ ] **Stop vs 用户中断** 是否需区分 DONE / IDLE
- [ ] **Codex App 多 thread 并行** 时 `session_id` / worktree 是否稳定
- [ ] **双 IDE 同时开**：Cursor + Codex 各写各 bridge，桌面 App 只读 `target_ide`
- [ ] **卸载**：卸 Codex Hook 不误删 Cursor；桌面 App 按 IDE 分卸
- [ ] **Windows**：`%USERPROFILE%\.codex\…` 路径与 App 窗口枚举
- [ ] **内置 Node**（桌面 App 代装 Codex Hook 时）
- [ ] **VSIX 在 Codex App 内是否可装**（目前判断：**不可**，以浮窗为主）
- [ ] **permission_mode: plan`** 是否映射 Plan 灯（默认冻结）
- [ ] **发版**：Codex VSIX 与 desktop hook-kit 同步版本号

---

## 6. Phase 计划

| Phase | 内容 | Cursor 回归 |
|-------|------|-------------|
| **0** | 侦察 Hook + 文档 + bridge 脚手架 | 不碰 Cursor 代码路径 |
| **1** | `codex-bridge-resolve` 定稿 + `install:codex-hooks` + 单 Agent 灯 | 全量 Cursor 测试 |
| **2** | Multi Agent + codex-extension VSIX | 同上 |
| **3** | 桌面浮窗 Codex（绑窗 / bridge 路径 / Hook 代装） | 同上 |
| **4** | Windows 实测 + README | 同上 |

---

## 7. 请你配合（Phase 0）

1. 在仓库根执行：`npm run install:codex-recon-hooks`
2. 打开 **Codex App**，对某项目跑一轮 Agent（尽量触发一次 **需要点批准** 的操作）
3. 在 Codex 里 **`/hooks`**，Trust 本工具相关 Hook
4. 把 `~/.codex/ai-traffic-lights/recon/` 下最新 `.jsonl` 发我（或贴 2–3 条样例）

有了真实 payload 后再锁定黄灯 / ERROR / Multi 细节。

---

## 8. 以后加 IDE 的模板

1. `scripts/lib/<ide>-bridge-paths.mjs`
2. `scripts/lib/<ide>-bridge-resolve.mjs`
3. `scripts/<ide>/hooks/write-bridge-from-<ide>-hook.mjs`
4. `tools/merge-<ide>-hooks.mjs`
5. `products/<ide>-extension/`（若该 IDE 支持 VS Code 系扩展）
6. 桌面 App `target_ide` + 窗口枚举
7. `docs/<ide>-adapter.md`

共享层仅扩展：`libs/protocol` 的 `ToolName`、`multi-agent-bridge` 的 `agentIdFrom` 字段表。
