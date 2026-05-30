# Phase 5 — 手机同步红绿灯（暂缓）

> **状态：** 📋 **已立项，暂不开发**（2026-05-30）  
> **前置：** Phase 3 Mac 桌面 App 稳定（v0.1.1+）；Windows 桌面待补  
> **接续：** 启动本 Phase 前读 [HANDOFF.md](HANDOFF.md) §0 · [desktop-app-status.md](desktop-app-status.md)

---

## 1. 产品目标

单用户：电脑跑 Cursor Agent 时，人在玩手机也能知道 Agent **完成 / 等你确认 / 出错**， ideally 手机上也显示三盏灯。

**数据源不变：** Hook → `~/.cursor/ai-traffic-lights/states/<id>/state.json`  
**新增：** 电脑端 **Publisher**（只读 watch，不改 Hook）→ 手机消费端。

---

## 2. 已确认约束（讨论结论）

| 项 | 决策 |
|----|------|
| 用户范围 | **仅绑定单用户**，不做团队 |
| 电脑 | Mac + Windows（与桌面 App 对齐） |
| 手机 | iPhone + Android |
| 理想形态 | 轻量 App + **扫码配对** |
| 无自建服务器 | **可行但能力分层**（见 §3） |
| 不做手机 App | **前台**可用浏览器/PWA 看灯；**后台**无法实时闪灯，需推送或第三方 App |
| 黄灯 | 与电脑相同，受 Cursor Hook 限制，不单独承诺 |

---

## 3. 方案分级（无 VPS 时）

### 3.1 零云成本 — 同一 WiFi 局域网

- 桌面 App 开 **局域网 HTTP/WebSocket** + 二维码（IP 或 mDNS）。
- 手机 **浏览器 / PWA** 打开 → **前台实时三盏灯**。
- **不花钱**；**不需要云端服务器**（电脑本机即服务）。
- **限制：** 必须同 WiFi；公司 Guest 网 AP 隔离可能失败；电脑休眠则停更；**外出 4G 不可用**。

### 3.2 无 VPS — 外出仍要联动

| 路线 | 说明 |
|------|------|
| **Tailscale**（推荐） | 个人免费；Mac/Win + 手机装客户端；虚拟局域网访问电脑 Publisher；仍无自购服务器 |
| **Firebase / ntfy 等** | 免运维 Relay + 推送；数据经第三方 |
| **仅推送（ntfy/Bark）** | 不做三盏灯 UI；实现「等你/完成/出错」通知最快 |

### 3.3 暂不建议第一步就做

- 自建 VPS Relay  
- Mac App Store 手机 App（与当前 Hook/隐私模型无关，成本高）  
- iCloud 同步 `state.json`  
- Hook 内直接发网络请求  

---

## 4. 联动逻辑（实现时）

**边沿推送 + 前台实时：**

| 状态 → | 手机 App 前台 | 手机后台 |
|--------|---------------|----------|
| `RUNNING` | 红灯 | 一般不推 |
| `WAITING_USER` | 黄灯（若准确） | 高优先级：「Agent 等你」 |
| `DONE` | 绿灯 | 「任务完成」 |
| `ERROR` | 红灯闪 | 「出错」 |

Publisher 只上报 **绑定 workspace** 的状态；通知正文避免完整 `workspaceRoot`，仅项目文件夹名 + `reason` 摘要。

---

## 5. 推荐 MVP（将来开工时）

1. **Mac 桌面 App** 增加 LAN Publisher + **PWA 状态页**（扫码打开）— 不开发原生手机 App。  
2. 可选：关键状态走 **ntfy** 一行配置（后台提醒）。  
3. V2：Tailscale 文档 + 可选原生 App / Live Activity。  
4. Windows：在 `platform_windows.rs` 就绪后复用同一 Publisher 模块。

**Exit criteria（MVP）：** 同 WiFi 下手机 Safari/Chrome 打开 PWA，三盏灯与电脑 `state.json` 一致（延迟 &lt; 2s）；`DONE` / `WAITING_USER` 可选 ntfy 通知。

---

## 6. 为何暂缓

- 当前优先级：**Mac 桌面包分发体验**（签名/公证）、**Windows 桌面**、内置 Node。  
- 局域网 MVP 价值主要在 **同网前台看灯**；与用户「外出玩手机也要提醒」之间仍有 **Tailscale 或推送**  gap，需产品再确认后再投入。

---

## 7. 相关文档

| 文档 | 用途 |
|------|------|
| [HANDOFF.md](HANDOFF.md) | 总阶段表 §0、待办 §9 |
| [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md) | Phase 5 条目 |
| [desktop-app-status.md](desktop-app-status.md) | 桌面 App 现状 |
