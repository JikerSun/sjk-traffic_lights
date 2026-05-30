# 桌面 App 需求与备忘（Phase 3+）

> **最后更新：** 2026-05-30（Phase 3.x 多 Agent 设计规格 · 见 [multi-agent-design.md](multi-agent-design.md)）  
> **产品定位：** **独立产品**（不依赖 VSIX；Hook 由 App 首次启动/安装时代装）  
> **开发约束：** 不得修改 `products/cursor-extension/` 及已验收的 Hook 映射逻辑（`scripts/lib/` 等）；桌面侧仅**复用/拷贝**现有 bridge 与 hook 脚本，或通过 App 安装器调用同等逻辑。

接续总览：[HANDOFF.md](HANDOFF.md) · 脚手架：[products/desktop-overlay/README.md](../products/desktop-overlay/README.md)

---

## 1. 已确认需求（2026-05-29）

### 1.1 平台与 IDE

| 项 | 要求 |
|----|------|
| 平台 | macOS + Windows |
| 首版 IDE | **Cursor** |
| 后期 IDE | Codex、Claude Code 等；用户在 App 内**选择当前跟踪对象** |
| 与侧边栏插件 | **独立**；用户可只装桌面 App |

### 1.2 窗口位置与交互

**核心原则：只做「一次性吸附定位」，不做持续跟窗 loop。**

浮窗 **always-on-top**；编辑器之后怎么移动、缩放，**都不再**自动改浮窗坐标。偏了可拖动，或菜单 **浮窗 → 恢复吸附到 Cursor 窗口** 再算一次（浮窗本身无按钮）。

#### 何时读取编辑器窗口位置并吸附

| 触发时机 | 行为 |
|----------|------|
| **浮窗 App 启动**且已绑定 Cursor 窗口 | 读 **一次** bounds → 全屏/非全屏规则放置 → **show** |
| **检测到 Cursor 启动**（此前因退出而 hide） | 窗口选择（§1.10）→ 绑定后 **读一次 bounds → 吸附 → show** |
| 用户菜单 **浮窗 → 恢复吸附**（Q1=B） | **再读一次** bounds → 重新吸附 |
| 用户在 **菜单 → 窗口** 切换绑定的 Cursor 窗口 | **再读一次** bounds → 吸附到新窗 |

#### 之后不做

| 不做 | 原因 |
|------|------|
| ❌ 任意间隔的 **跟窗位置 loop** | 产品不要；最上层不会被编辑器盖住 |
| ❌ 监听编辑器 **move / resize** | 同上 |

#### 吸附那一刻：全屏 / 非全屏

| 窗口是否占满屏幕（含最大化） | 吸附位置 |
|------------------------------|----------|
| 是 | **内部**左上角 |
| 否 | **外部**左上角 |

之后用户最大化/拖窗，浮窗 **保持原坐标**，直到上表再次触发。

#### 其它

| 项 | 行为 |
|----|------|
| 拖动 | Q1=B：自由位置，不自动再吸附 |
| 多 Cursor 窗口 | §1.10 |
| 层级 | Q6：always-on-top（§1.8） |

### 1.3 状态检测（可靠性优先）

- **采用：** App 安装/首次启动时**自动补全 Cursor 全局 Hook**（等同 `npm run install:global-hooks`：拷贝 `~/.cursor/ai-traffic-lights/` + 合并 `hooks.json`）。
- **不采用：** 纯 transcript 轮询作为主路径（准确度低于 Hook，见 [traffic-lights-runtime.md](traffic-lights-runtime.md)）。
- 桌面 UI 读 **`~/.cursor/ai-traffic-lights/states/<workspaceId>/state.json`**（与插件同源）；`fs.watch`，**不轮询** state 文件。

### 1.4 性能

| 层级 | 策略 |
|------|------|
| Hook（已有 v4.7） | 仅 Agent 事件时短生命周期 Node 子进程；无事件零占用 |
| 桌面 App · 状态 | `fs.watch` 读 `state.json`，不轮询 |
| 桌面 App · 位置 | **仅 §1.2 四时机**读一次 bounds；**无跟窗 loop** |
| 桌面 App · 窗口列表 | 低频 2–3s 或 OS 事件，**只**为 §1.10 选择框，不为跟位置 |
| 桌面 App · 显隐 | Cursor 退出 → hide（§1.11） |
| 安装 | Hook 脚本与 `scripts/lib/` 同版本拷贝 |

### 1.5 开发边界（硬约束）

- **禁止**为桌面 App 改 `products/cursor-extension/**`。
- Hook/bridge **逻辑变更**仅在 `scripts/lib/`、`tools/merge-user-hooks.mjs` 等共享层；桌面 App 通过**安装器打包这些文件**，不 fork 一份新逻辑。

### 1.6 Node 运行时（Q2 — 已确认）

安装 / 更新 Hook 时：

1. 检测本机是否已有 **Node ≥ 20**（`PATH` 或常见安装路径）。
2. **有** → `hooks.json` 里 command 使用系统 `node`。
3. **无** → 使用 **App 内置 Node** 的绝对路径（随 App 分发，仅 Hook 子进程使用）。

App 本体（Tauri）不依赖用户单独安装 Node。

### 1.7 卸载（Q3 — 已确认）

卸载桌面 App 时**同步**：

- 执行与 `npm run uninstall:global-hooks` 等价的逻辑（删 `~/.cursor/ai-traffic-lights/`，从 `hooks.json` 移除本工具条目）。
- 若移除后 `hooks.json` **仅剩空壳或无其它 command** → **删除整个 `hooks.json`**（与现有 `merge-user-hooks.mjs uninstall` 行为一致）。

### 1.8 顶层显示（Q6 — 已确认 + 技术边界）

- 产品要求：浮窗在 **z-order 最上层**；正常应用窗口不得遮挡。
- **无法保证**压过：macOS 系统权限弹窗、部分 Screen Saver、Secure Input、Windows UAC、部分全屏游戏/独占层。实现使用各平台 **always-on-top / floating panel** API，并在文档中说明上述例外。

### 1.9 平台策略（Q5 — 已确认）

- **目标：** Mac + Windows **同一套代码**（Tauri 跨平台 + 条件编译仅用于窗口 API 差异）。
- **排期：** 两平台一起做；若某平台窗口跟踪/Hook 路径阻塞，可先交付 Mac 再补 Windows，**不拆两套业务逻辑**。

### 1.10 窗口选择 UI（Q4 细化 — 2026-05-29）

| 时机 | 行为 |
|------|------|
| **首次打开 App** | 枚举 Cursor 窗口：**仅 1 个** → 自动绑定，**不弹窗**；**≥2 个** → **自动弹出**选择框（标题 + 工作区/项目路径） |
| **设置页** | 常驻 **下拉列表**（窗口标题 / 项目路径），供 App 运行中用户**主动切换**（例如新开了 Cursor 窗口） |
| **窗口集合变化** | 见下方性能结论：**采用低频检测**；集合变化（关窗 / 新开 / 数量变）→ **再次弹出**选择框 |

**不采用：** 复杂点选模式、始终跟前台窗口。

**实现建议（性能）：**

- 窗口列表：**每 2–3 秒** 枚举一次（或 OS 应用启动/退出 **事件** + 低频校验），对比窗口 ID 集合 fingerprint；**仅变化时**弹窗。单次 API 调用，CPU 可忽略。
- 若实测某平台枚举过慢，可降为 **仅设置下拉 + 首启弹窗**，关闭自动再弹（产品可接受回退）。

### 1.11 绑定编辑器退出 → 隐藏浮窗（2026-05-29 新增）

| 项 | 决策 |
|----|------|
| 场景 | 浮窗绑定 **Cursor**；用户 **Cmd+Q / 退出** Cursor（或绑定窗口所属进程结束） |
| 行为 | **不展示**红绿灯浮窗（隐藏即可，不必销毁窗口） |
| Cursor 再次启动 | 窗口选择（§1.10）→ **一次 bounds → 吸附 → show** |
| 性能 | **`hide` / `show` + OS 退出事件**；无跟窗 loop（§1.2） |

**性能分析：**

| 机制 | 成本 |
|------|------|
| 监听 Cursor **进程退出 / 启动** | **极低** — 事件驱动 |
| 浮窗 **hide** vs destroy | **hide 更省** |
| 位置 | **仅 show/吸附时读 1 次 bounds** — 无定时 loop |
| `state.json` **fs.watch** | 内核事件，可常开；Cursor hide 时 UI 不可见即可 |

---

## 2. 多 Agent 检测与计数 UI（Phase 3.x · 未实施）

> **完整规格：** [multi-agent-design.md](multi-agent-design.md)（**实施前必读**）  
> **原则：** **Single Agent 行为零回归**；Multi 仅在 `N_active ≥ 2` 时启用。

### 2.1 产品摘要

| 模式 | 条件 | UI |
|------|------|-----|
| **Single** | Active Set 中 **≤1** 个在管 Agent | **与现版一致**，无数字 |
| **Multi** | **≥2** 个在管 Agent | 各灯可同时亮；亮灯显示 **该状态下 Agent 数量**（数字色与灯色接近但可区分） |

- **在管 Agent** = 有 Hook 的 `conversation_id`，**不是** Cursor 列表全长（历史未用的 **不记录**）。  
- 文中举例的个数（如 10/8/5/3）**仅为说明**，实现用 `T_done` / `T_stale` / `MAX_ACTIVE` 等 **可配置常量**。  
- DONE 在宽限 `T_done` 内仍算 Active（绿灯计数）；过期 prune。

### 2.2 非功能（必达）

| 维度 | 要求 |
|------|------|
| **性能** | Single 快路径；`counts` 不变不写盘；Multi debounce；无 state 轮询 |
| **内存/文件** | 单文件 **覆盖写**；`agents` **必须 prune**；大小有上界（见设计 doc §5） |
| **准确度** | Single 100% 回归；Multi 依赖 `conversation_id` + 写锁；黄/Plan 不优于现版 |
| **兼容** | 顶层 `state`/`sessionId` 保留；旧 VSIX 可读 v1 |

### 2.3 实施前

- [ ] Hook **Spike**：并行 2～3 Agent，验证 `conversation_id` / `sessionEnd`  
- [ ] §8.1 Single 回归测试全过后再开 Multi UI  
- [ ] 变更仅在 `scripts/lib/` + UI；**禁止**改坏 `products/cursor-extension/` 的 Single 路径语义

**Phase 3.0～3.1 不做 Multi**；Mac v0.1.1 桌面/App 先稳定后再做。

---

## 3. Phase 3 MVP 验收（Cursor · Mac + Windows）

- [ ] App 首次启动：Hook 自动安装（已装且版本一致则跳过）
- [ ] Node：有系统 Node≥20 用系统，否则用 App 内置 Node 写进 hooks
- [ ] 浮窗红 / 绿 / ERROR 与 `state.json` 一致（`fs.watch`）
- [ ] 首启：1 个 Cursor 窗自动绑；多窗在 **菜单 → 窗口** 选择（或「选择窗口…」弹窗）
- [ ] 吸附：仅 App 启动 / Cursor 启动 / 恢复吸附 / 菜单换窗 时 **读一次 bounds**；**无跟窗 loop**
- [ ] 占满屏 → 内左上；未占满 → 外左上（仅吸附那一刻判定）
- [ ] Cursor 退出 → hide；再起 → 选择 + 一次吸附 + show
- [ ] 拖动后自由位置；菜单 **浮窗 → 恢复吸附**（Q1=B；浮窗无按钮）
- [ ] always-on-top；Hook 无 Agent 时常驻零占用
- [ ] 卸载 App → 同步卸 Hook；空则删 `hooks.json`
- [ ] macOS + Windows 安装包各一（同一 codebase）

---

## 4. 产品决策记录（2026-05-29）

| # | 决策 |
|---|------|
| Q1 | **B** — 拖动后自由位置，点「恢复吸附」才再跟窗 |
| Q2 | 检测 Node≥20；有则用系统，无则用 App 内置 Node |
| Q3 | 卸载同步移除 Hook；`hooks.json` 无其它条目则删整文件 |
| Q4 | 首启 1 窗自动绑 / 多窗菜单选；**窗口** 子菜单 + 「选择窗口…」；低频刷新列表 |
| Q5 | Mac + Windows 同代码一起做；阻塞则 Mac 先、Windows 后 |
| Q6 | **占满屏幕即全屏**（含最大化）；浮窗 **最顶层**（系统级弹窗除外） |
| **新增** | Cursor 退出 → **hide**；无持续跟窗 loop |
| **吸附** | **仅 4 次触发**读 bounds：App 启 / Cursor 启 / 菜单恢复吸附 / 菜单换窗；之后不监听 move/resize |

---

## 5. 相关文档

| 文档 | 内容 |
|------|------|
| [HANDOFF.md](HANDOFF.md) | 阶段、待办、待决问题 |
| [multi-agent-design.md](multi-agent-design.md) | **多 Agent 完整设计（Phase 3.x）** |
| [traffic-lights-runtime.md](traffic-lights-runtime.md) | Hook / bridge 运行时 |
| [architecture.md](architecture.md) | adapters 边界 |
| [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md) | 长期 Phase |
