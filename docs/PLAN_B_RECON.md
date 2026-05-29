# Plan B — Hook 侦察（Questions 弹窗）

**目的：** 在 Questions / AskQuestion 界面出现、停留、点 Continue 的全程，记录 Cursor **所有 Agent hook** 的原始事件，判断有没有可对齐黄灯的时刻。

**不改变：** 红/绿逻辑仍走 `write-bridge-from-hook.mjs`（经 wrapper 转发）。

## 已接入的 hook 事件（与红绿灯同一脚本，无子进程）

`beforeSubmitPrompt` / `preToolUse` / `postToolUse` / `beforeMCPExecution` / `afterMCPExecution` / `afterAgentThought` / `afterAgentResponse` / `stop`

> 曾用 18 个 hook + wrapper 子进程，会导致 Cursor **整份 hooks 失效**（你遇到的「灯全灭、recon 无日志」）。已改回单脚本直写。

## 日志位置

| 文件 | 内容 |
|------|------|
| `.ai-traffic-lights/recon-events.log` | 全量侦察（JSONL，含 `ask_hint`、`transcript_phase`） |
| `.ai-traffic-lights/recon-summary.json` | 最近一条事件摘要 |
| `.ai-traffic-lights/recon-test-marker.json` | 你手动打的测试起点时间 |

`ask_hint=true` 或 stderr 里 `[recon] ★` 表示 payload 里像 AskQuestion。

## 操作步骤

1. **Reload Window**（必须，否则新 hooks 不生效）
2. 终端 A：`npm run bridge:watch`（可选，只看灯）
3. 终端 B：清空并打起点标记  
   ```bash
   npm run debug:recon:clear
   npm run debug:recon:mark
   ```
4. 在 Agent 里发一句：**「给我一道 ABC 选择题」**
5. 等 Questions 面板出现 → **停留约 3 秒** → 选一个选项 → **Continue**
6. 等 Agent 回复结束
7. 导出侦察日志：  
   ```bash
   npm run debug:recon:inspect
   npm run debug:recon:inspect:ask
   ```
8. 把终端输出（或 `recon-events.log` 最后 30 行）发给我，并注明：面板出现/点 Continue 的大致时间点。

## 若灯全灭 / recon 无日志

1. 确认 `hooks.json` 为精简版（非 18 个 hook 的 wrapper 版）
2. **Reload Window**
3. `npm run debug:set:running` 或发一条 Agent 消息验证 hook 是否写入 `hook-events.log`

## 如何解读结果

| 结果 | 含义 |
|------|------|
| 面板出现时就有 `preToolUse` + `tool_name=AskQuestion` | 可用 hook 做黄灯（最理想） |
| 只有 `afterAgentThought` / 别的事件，没有 AskQuestion | 需用该事件 + 规则推黄灯 |
| 全程无 `ask_hint`，只有 `stop` / `afterAgentResponse` | 与现状一致，hook 抓不到弹窗时机 |
| `transcript_phase=awaiting_selection` 但晚于 Continue | 只能靠 transcript，且偏晚 |
