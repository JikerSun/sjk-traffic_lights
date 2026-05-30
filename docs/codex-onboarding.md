# Codex Onboarding

> **主规格：** [docs/codex-adapter.md](../../docs/codex-adapter.md)

## 你的环境

- **Codex 桌面 App**（非 VS Code 内嵌）→ 三盏灯优先用 **桌面浮窗**（Target IDE = Codex）
- **VS Code + Codex 扩展** 用户 → 后续安装 `ai-traffic-lights-codex.vsix`（Phase 2）

## Phase 0 — 侦察 Hook（当前）

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights
npm install
npm run install:codex-recon-hooks
```

1. Codex App → **`/hooks`** → Trust AI Traffic Lights 相关 Hook  
2. 跑几轮 Agent（尽量触发一次 **批准/确认**）  
3. 把 `~/.codex/ai-traffic-lights/recon/<date>/hook-events.jsonl` 发给维护者  

## Phase 1+ — 正式 Hook

```bash
npm run uninstall:codex-hooks   # 若曾装 recon
npm run install:codex-hooks
```

Bridge：`~/.codex/ai-traffic-lights/states/<workspace-id>/state.json`

## 验收（与 Cursor 对齐）

- Single：无数字 badge，红→绿  
- Multi：并行计数  
- 黄闪：`PermissionRequest`（待实测）  
- 红闪：`ERROR`（待 recon 定稿）  

## 开发 checklist

1. `CodexAdapter` in `libs/adapters`（可选；当前 Hook→bridge 为主路径）  
2. `codex-bridge-resolve.mjs` 对照 recon 定稿  
3. `products/codex-extension` VSIX  
4. 桌面 App `target_ide=codex`  
5. Cursor 全量回归  
