# 多 Agent 状态检测与计数 UI — 设计规格

> **状态：** ✅ **已实施**（2026-05-30，扩展 **v0.1.6** + 全局 Hook + 桌面 overlay 同 core）  
> **优先级：** Phase 3.x（Mac 桌面 v0.1.1 之后）· 在 **单 Agent 行为零回归** 前提下开发  
> **接续：** [HANDOFF.md](HANDOFF.md) §0 · [desktop-app-requirements.md](desktop-app-requirements.md) §2 · [traffic-lights-runtime.md](traffic-lights-runtime.md)

---

## 0. 文档说明

- 文中 **10 / 8 / 5 / 3** 等数字均为 **举例**，**不得** 在代码或配置里写死。  
- 实现使用 **规则 + 可配置常量**（宽限期、上限等），常量名见 §6。  
- **禁止** 扫描 Cursor Agent 历史列表；**仅 Hook 驱动** 的 Active Set。

---

## 1. 产品目标

同一 **workspace**（绑定 Cursor 窗口对应的项目）内，用户可能 **并行运行多个 Agent**。UI 需：

| 场景 | UI |
|------|-----|
| **仅 1 个在管 Agent** | 与 **现版完全一致**：一组三盏灯、互斥主状态、**无数字** |
| **≥ 2 个在管 Agent** | **Multi 模式**：各灯 **可同时亮**；亮着的灯上显示 **该状态下 Agent 数量**（数字色接近灯色但可区分） |

**示例（说明用，非常量）：**  
N 个并行 RUNNING → 红灯 + 数字 N；其中 M 个变为 DONE（宽限内）→ 红灯数字减、绿灯亮且带 M；全部只剩 1 个在管 → 退回 Single，无数字。

---

## 2. 核心概念

### 2.1 Active Set（在管 Agent）

Agent 由 Hook payload 的 **`conversation_id`**（或 `session_id`）标识。

**Active** 当且仅当：

1. 曾收到带有效 `conversation_id` 的 Hook；且  
2. `state ∉ { IDLE }`，**或** `state === DONE` 且仍在 **DONE 展示宽限期** `T_done` 内；且  
3. `now - lastHookTs < T_stale`（长期无 Hook 则强制归档）。

**不在 Active Set：**

- Cursor 侧边栏里 **无 Hook 的历史会话**（用户「这次不用」的那些）— **不会** 被枚举或预加载。

### 2.2 展示模式（实现补充）

设计稿用 `N_active = |Active Set|`；**v0.1.6 实现**改为按 **working / 波次** 判定，避免「4 DONE + 1 新 RUNNING」仍显示 Multi：

| 条件 | displayMode |
|------|-------------|
| ≥2 个 **working**（RUNNING / WAITING / ERROR / PLAN） | `multi` |
| 仅 DONE≥2、无 working（同一波刚结束） | `multi`（如绿 4） |
| 1 working + 旧 DONE，且新 Agent `runningSince` 晚于全部 `doneAt` | `single`（清旧 DONE，无 badge） |
| 其余 | `single` |

```
N_active <= 1  →  displayMode = "single"   // 现版行为（文档原意）
N_active >= 2  →  displayMode = "multi"     // 见上表 working/波次规则
```

**可选（实现阶段）：** Multi → Single 切换加 **3～5s 滞后**，避免宽限边界抖动。

### 2.3 Multi 模式计数

对每个 Active Agent 有且仅有一个 `state`：

| 计数 | 状态 |
|------|------|
| `nRunning` | `RUNNING` |
| `nWaiting` | `WAITING_USER` |
| `nError` | `ERROR` |
| `nDone` | `DONE`（宽限内） |
| `nPlan` | `WAITING_PLAN_BUILD` |

**亮灯（Multi）：**

| 灯 | 亮 | 数字 |
|----|-----|------|
| 红（常亮） | `nRunning > 0` | `nRunning` |
| 红（闪） | `nError > 0` | `nError`（见 §2.4） |
| 黄（闪） | `nWaiting > 0` | `nWaiting` |
| 绿 | `nDone > 0` | `nDone` |

**规则：**

- 某灯亮 ⟺ 对应 `n* > 0`；数字 **等于** 该 `n*`。  
- **Single 模式禁止显示任何数字**（含「1」）。  
- Multi 模式下 **禁止** `n*=0` 仍亮该灯。

### 2.4 并存态（产品定案）

| 情况 | 决策 |
|------|------|
| `nError > 0` 且 `nRunning > 0` | **ERROR 优先**：红灯 **闪烁**，数字显示 **`nError`**；RUNNING 数 **不** 与 ERROR 数字合并（V1 简化） |
| `nPlan > 0` | V1：**并入 `nRunning` 计数**（Plan 灯本身信号弱，见 runtime 限制）；不单独红黄闪 Multi 数字 |
| 黄灯准确度 | 与现版相同，**不承诺** Multi 下 `nWaiting` 可靠 |

### 2.5 Single 模式（回归保障）

当 `N_active <= 1`：

- Hook **必须** 走现有 **单 Agent 管道**（`resolveBridgeState` + 顶层 `state` / `sessionId`）。  
- **不** 写入 `agents{}`、**不** 计算 `counts`（或写了 UI 也 **不得** 读 Multi 字段）。  
- 扩展 v0.1.5、桌面 overlay **行为与现版 byte-for-byte 等价**（测试矩阵 §8.1）。

---

## 3. Bridge 协议 v2（兼容 v1）

**路径不变：** `~/.cursor/ai-traffic-lights/states/<workspaceId>/state.json`

**覆盖写单文件** — **禁止** append 事件日志。

```json
{
  "tool": "cursor",
  "state": "RUNNING",
  "sessionId": "<conversation_id>",
  "reason": "...",
  "source": "...",
  "ts": 0,
  "workspaceRoot": "...",
  "workspaceStateId": "...",

  "bridgeVersion": 2,
  "displayMode": "single",
  "counts": {
    "running": 0,
    "waiting": 0,
    "done": 0,
    "error": 0,
    "plan": 0
  },
  "agents": {
    "<conversation_id>": {
      "state": "RUNNING",
      "reason": "...",
      "ts": 0,
      "lastHookTs": 0
    }
  }
}
```

| 字段 | Single | Multi | 旧客户端 |
|------|--------|-------|----------|
| `state` / `sessionId` | ✅ 主展示 | ✅ 兼容：可为聚合最高优先级态 | ✅ 只读此项即可 |
| `displayMode` | `single` | `multi` | 忽略 → 当 single |
| `counts` | 省略或全 0 | ✅ UI 主读 | 忽略 |
| `agents` | 省略或 ≤1 条 | ✅ Hook 维护 | 忽略 |

**聚合优先级（仅用于顶层 `state` 兼容旧 UI）：**  
`WAITING_USER` > `ERROR` > `RUNNING` > `WAITING_PLAN_BUILD` > `DONE` > `IDLE`

---

## 4. Hook 逻辑（低耗能）

### 4.1 流程

```
Hook 事件
  → 无 conversation_id ? 仅 Single _legacy 路径或 skip agents（禁止 merge 到假 id）
  → prune Active Set（内存，O(n)）
  → N_active <= 1 ? Single 快路径（现版）→ 变化才写 state.json → exit
  → Multi 路径：
        更新 agents[id]
        重算 counts / displayMode
        counts 与 displayMode 与上次写入相同 ? exit（0 写盘）
        否则 debounce 合并（建议 50～80ms）→ 一次覆盖写 state.json
```

### 4.2 写盘策略（性能）

| 规则 | 目的 |
|------|------|
| **Single 快路径** | 绝大多数时间零 Multi 开销 |
| **`shouldHookWriteBridge` 保留** | 抑制重复 RUNNING |
| **counts 不变不写** | 降 I/O 与 fs.watch 唤醒 |
| **debounce 50～80ms** | 并行 Agent 工具风暴时合并写 |
| **仅覆盖写** | 文件大小有上界 |
| **禁止** UI/API 轮询 state | 仍只用 `fs.watch` |

### 4.3 并发 Hook

多 Hook 子进程可能并行 → **必须** workspace 级 **短锁** + 读-改-写（或 `bridgeVersion` 乐观重试），避免覆盖导致 **计数错乱**。

### 4.4 生命周期

| 事件 | 行为 |
|------|------|
| 任意 Hook | upsert `agents[id]`，更新 `lastHookTs` |
| `sessionEnd` | **仅** 该 `id` → IDLE / 移出 Active；**禁止** workspace 全局 IDLE |
| DONE | 进入 Active 宽限 `T_done`；过期 prune |
| 超 `T_stale` 无 Hook | 移出 `agents` |

### 4.5 Transcript

Multi 下仍 **按事件类型懒读** transcript（与 v4.7 一致）；`preToolUse`/`postToolUse` 仅 RUNNING 时不读全量。

---

## 5. 内存与文件大小

| 项 | 保证 |
|----|------|
| 单 workspace `state.json` | **有上界**：≈ `MAX_ACTIVE × ~200B` + 固定 overhead（通常 **< 32KB**） |
| 磁盘增长 | **不** 随 Hook 次数线性涨（非 log） |
| Hook 进程 | 短生命周期，**不** 累积 |
| UI parse | 单文件一次 parse；**相同 counts 不重绘** |
| prune | **写前**执行；**无** 独立定时 prune 进程 |

**可配置常量（默认值建议，可调）：**

| 常量 | 建议默认 | 含义 |
|------|----------|------|
| `T_done` | 10 min | DONE 仍算 Active、绿灯计数 |
| `T_stale` | 24 h | 无 Hook 则移出 agents |
| `MAX_ACTIVE` | 20 | 超出丢弃 **最旧 lastHookTs** |
| `DEBOUNCE_MS` | 50～80 | Multi 写合并 |
| `MODE_HYSTERESIS_MS` | 0（可选 3000） | Multi↔Single 滞后 |

---

## 6. 准确度与已知限制

| 项 | 把握 | 说明 |
|----|------|------|
| Single 回归 | **必须 100%** | 独立快路径 + §8.1 测试 |
| Multi 算术 | **高** | id 稳定 + 锁 + prune 正确则自洽 |
| `conversation_id` 缺失 | **风险** | 无 id 则不进 agents；需 **Spike** 实测 |
| 黄灯 / Plan | **与现版同弱** | 不单独提升 |
| 并发写 | **需锁** | 否则偶发错数 |

**实施前 Spike（必做）：**

1. 同一 workspace **并行 2～3 Agent**，`TRAFFIC_LIGHTS_DEBUG=1` 录 Hook payload。  
2. 验证 `conversation_id` 稳定、互不相同。  
3. 一个 `stop(completed)` 时其它仍 RUNNING 的行为。  
4. `sessionEnd` 是否 per-conversation。

---

## 7. UI（扩展 + 桌面 overlay）

- **Single：** 现有 `TrafficLightEngine` / overlay 逻辑 **不改语义**。  
- **Multi：** 读 `displayMode === "multi"` + `counts`；多灯同亮 + 数字样式：  
  - 数字色 **接近灯色、可区分**（深浅 + 描边）；  
  - 浮窗尺寸有限，**≥10** 可显示 `9+`（阈值可配置，非写死 10）。  
- **旧 VSIX：** 仅读顶层 `state`，无数字 — 可接受；升级后才有 Multi UI。

---

## 8. 测试矩阵

### 8.1 Single 回归（发布门槛 — 全部必过）

| # | 场景 | 期望 |
|---|------|------|
| S1 | 1 Agent RUNNING → DONE | 与 v0.1.5 / desktop v0.1.1 **一致** |
| S2 | bridge 无 `agents` / v1 形状 | UI 正常 |
| S3 | `N_active` 从 2→1 | 立即 Single，**无数字** |

### 8.2 Multi 功能

| # | 场景 | 期望 |
|---|------|------|
| M1 | N 个 RUNNING（N≥2） | 红灯 + 数字 N |
| M2 | 部分 DONE（宽限内） | 红/绿同亮，数字分别为剩余 RUNNING 与 DONE 数 |
| M3 | 历史会话无 Hook | counts 不受影响 |
| M4 | DONE 过 `T_done` | 绿灯数字减；`N_active` 更新 |
| M5 | 1 ERROR + 多 RUNNING | 红灯闪，数字 = `nError` |
| M6 | 20+ 并发 Hook/s | 写盘次数 **远小于** Hook 次数；UI 不闪 |

### 8.3 内存 / 文件

| # | 场景 | 期望 |
|---|------|------|
| F1 | 长时间运行 + prune | `state.json` 大小 **稳定**，不线性增长 |
| F2 | 超过 `MAX_ACTIVE` | 最旧项丢弃，文件仍 < 上界 |

---

## 9. 实现顺序（建议）

1. **Spike**（§6）  
2. **`scripts/lib/`** — `agents` map、prune、counts、Single 快路径、锁、debounce（**不改 extension**）  
3. **`sync:hook-kit`** + 全局 Hook 验证 Single 回归  
4. **扩展** — Multi UI + counts  
5. **desktop-overlay** — 同逻辑  
6. 文档 + 版本号（bridge v2）

**硬约束：** 步骤 3 未过 §8.1 **不得** 发 Multi UI。

---

## 10. 相关文档

| 文档 | 内容 |
|------|------|
| [traffic-lights-runtime.md](traffic-lights-runtime.md) | Hook 写策略、黄/Plan 限制 |
| [desktop-app-requirements.md](desktop-app-requirements.md) | 桌面边界、§2 摘要 |
| [HANDOFF.md](HANDOFF.md) | 阶段表、待办 |
| [desktop-app-status.md](desktop-app-status.md) | 桌面现况 |
