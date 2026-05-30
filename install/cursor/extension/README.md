# Cursor 扩展（VSIX）

**当前版本：** v0.1.6 · Multi Agent 计数 UI + Single 模式回归

## 方式 A：GitHub Release（推荐）

1. 打开 [Releases](https://github.com/JikerSun/sjk-traffic_lights/releases/tag/v0.1.6)
2. 下载 **`ai-traffic-lights-cursor.vsix`**
3. **若曾装过旧版或本地调试版：** 先 `Cmd+Q` **完全退出 Cursor**（Reload 不够）
4. 安装（任选其一）：
   - **UI：** `Cmd+Shift+P` → **Extensions: Install from VSIX...** → 选 `.vsix`
   - **终端（Cursor 关闭时）：**
     ```bash
     "/Applications/Cursor.app/Contents/Resources/app/bin/cursor" --install-extension /path/to/ai-traffic-lights-cursor.vsix
     ```
5. 打开 Cursor → **Reload Window**

**常见错误：** `Please restart VS Code before reinstalling AI Traffic Lights`  
→ 完全退出 Cursor 后，用上面终端命令安装。

还需 **全局 Hooks**（扩展只读状态、不写 Hook）：

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights && npm install
npm run install:global-hooks
```

详见 [global-hooks/README.md](../global-hooks/README.md) 与根 [README.md](../../../README.md)。

## 卸载扩展

**方式 1 — 仓库脚本（本地调试安装）：**

```bash
npm run uninstall:cursor-extension
```

**方式 2 — Cursor UI：** Extensions → **AI Traffic Lights** → Uninstall → Reload Window

**方式 3 — 终端（Cursor 关闭时）：**

```bash
"/Applications/Cursor.app/Contents/Resources/app/bin/cursor" --uninstall-extension local.ai-traffic-lights-cursor-extension
```

## 方式 B：在本仓库构建

```bash
npm run package:extension
```

生成：**本目录** `ai-traffic-lights-cursor.vsix`（`.gitignore` 不提交；Release 附件上传）。

## 方式 C：开发者本地安装（不经过 VSIX）

```bash
npm run install:cursor-extension:local
```

然后 Reload Window。发布前请改用 VSIX 或 Release 测用户路径。

## v0.1.6 相对 v0.1.5

- **Multi Agent：** 并行 ≥2 个 Agent 时，灯上显示各状态计数
- **Single 回归：** 仅 1 个在跑 Agent 时与 v0.1.5 一致（无数字）
- **新一轮单独 Agent：** 上一波全 DONE 后新开 1 个 Agent → 自动回 Single，不叠旧绿灯

Hook 侧 Multi 逻辑需 **`npm run install:global-hooks`** 更新到最新。
