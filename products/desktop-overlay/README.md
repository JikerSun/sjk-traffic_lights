# Desktop Overlay (Tauri)

**v0.1.1** — Mac Apple Silicon dmg 可装；Setup 启动向导 + Settings 菜单运行期切换

## 用户安装（Mac）

从 GitHub Releases 下载 **`AI Traffic Lights_*_aarch64.dmg`**：  
https://github.com/JikerSun/sjk-traffic_lights/releases  

步骤：[install/desktop/README.md](../../install/desktop/README.md)

## 开发（Mac）

```bash
# 仓库根目录
npm install
npm run dev:desktop
```

测试：[docs/desktop-app-testing-mac.md](../../docs/desktop-app-testing-mac.md)  
**接续必读：** [docs/desktop-app-status.md](../../docs/desktop-app-status.md)

## 打包

```bash
npm run build:desktop   # 根目录
```

| 平台 | 产物 |
|------|------|
| Mac | `src-tauri/target/release/bundle/dmg/*.dmg` |
| Windows | `src-tauri/target/release/bundle/nsis/*-setup.exe`（**仅 Windows 机构建**） |

Windows 步骤：[install/desktop/README.md](../../install/desktop/README.md) §C

## 架构

- **Tauri 2** + Vite：`setup.html`（启动）· `settings.html`（Preferences）· `overlay.html`（浮窗）
- **菜单**：`Settings ▶ Window / Overlay / Uninstall` + `Open Preferences…`
- **Hook**：`resources/hook-kit/` ← `npm run sync:hook-kit`
- **状态**：`fs.watch` → `~/.cursor/ai-traffic-lights/states/.../state.json`
- **窗口**：macOS `platform_macos.rs`；Windows `platform_windows.rs` ⚠️ stub
- **不改** `products/cursor-extension/`

需求：[docs/desktop-app-requirements.md](../../docs/desktop-app-requirements.md)
