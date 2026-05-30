# 桌面悬浮 App — 安装与打包

独立产品（**不依赖 VSIX**）。Hook 由 App 首次启动自动安装。

| 目录 | 说明 |
|------|------|
| [mac/](mac/) | 本地构建后的 `.dmg` 副本（可选；**推荐从 GitHub Releases 下载**） |
| [windows/](windows/) | Windows 安装包占位（需在 Windows 上构建） |

**实现状态与已知问题：** [docs/desktop-app-status.md](../../docs/desktop-app-status.md)

---

## A. Mac 用户 — 下载安装（推荐）

### 方式 1：GitHub Releases（推荐给同事）

1. 打开 **[Releases](https://github.com/JikerSun/sjk-traffic_lights/releases)**
2. 找到标签 **`desktop-v0.1.2`**（或最新 `desktop-v*`）
3. 下载 **`AI Traffic Lights_0.1.2_aarch64.dmg`**（Apple Silicon / M 系列）
4. 双击 dmg → 将 **AI Traffic Lights** 拖到 **Applications**
5. **去掉下载隔离**（浏览器下载后常需要；若提示「已损坏」也先执行此步）：

```bash
xattr -cr "/Applications/AI Traffic Lights.app"
```

6. 双击打开 App（若仍被拦截：**系统设置 → 隐私与安全性 → 仍要打开**；当前包未公证）
7. 启动后出现 **Setup** 英文向导 → 选 IDE + Cursor 窗口 → **Continue**
8. 需要 **Node.js ≥ 20**（Hook 安装/卸载；App 会自动查找 Homebrew 等常见路径）
9. 跑 Cursor Agent → 浮窗红 / 绿应随 `state.json` 变化

**若双击后「意外退出」：** 多为首次 Hook 安装失败。在终端执行一次（会显示具体错误）：

```bash
xattr -cr "/Applications/AI Traffic Lights.app"
"/Applications/AI Traffic Lights.app/Contents/MacOS/ai-traffic-lights-desktop"
```

Hook 装成功后，之后可直接双击打开。

**Intel Mac：** Release 若只有 `aarch64`，需维护者另传 `x86_64` dmg，或自行源码构建（见下方 B）。

### 方式 2：本仓库本地构建

```bash
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights
npm install
npm run build:desktop
```

产物：

| 文件 | 路径 |
|------|------|
| **dmg** | `products/desktop-overlay/src-tauri/target/release/bundle/dmg/AI Traffic Lights_0.1.2_aarch64.dmg` |
| **.app** | `products/desktop-overlay/src-tauri/target/release/bundle/macos/AI Traffic Lights.app` |

可选复制到本目录方便分发：

```bash
cp "products/desktop-overlay/src-tauri/target/release/bundle/dmg/"*.dmg install/desktop/mac/
```

### 前置条件（构建机）

- macOS 12+
- **Node.js ≥ 20**、`npm install`
- **Rust**（[rustup.rs](https://rustup.rs)）→ `source "$HOME/.cargo/env"`
- Xcode **Command Line Tools**：`xcode-select --install`

### 彻底卸载（App + Hook）

1. **Quit** App（菜单 Quit / ⌘Q）
2. Preferences → **Uninstall AI Traffic Lights…** 查看弹窗中的 Terminal 命令；或手动：

```bash
# Hook（路径以 Preferences 弹窗为准；开发包示例）
AI_TL_KIT_ROOT="/Applications/AI Traffic Lights.app/Contents/Resources/hook-kit" \
  node "/Applications/AI Traffic Lights.app/Contents/Resources/hook-kit/merge-user-hooks.mjs" uninstall
```

3. 删除 App：`rm -rf "/Applications/AI Traffic Lights.app"` 或拖到废纸篓
4. 重启 Cursor

---

## B. 维护者 — 发布 Mac dmg 到 GitHub

在仓库根目录，构建完成后：

```bash
npm run build:desktop

# 使用 GitHub CLI（需 gh auth login）
gh release create desktop-v0.1.2 \
  --title "Desktop App v0.1.2 (Mac)" \
  --notes "Multi Agent overlay badges; shared state with extension v0.1.6. Install: install/desktop/README.md §A." \
  "products/desktop-overlay/src-tauri/target/release/bundle/dmg/AI Traffic Lights_0.1.2_aarch64.dmg"
```

或在 GitHub 网页：**Releases → Draft a new release → 上传 dmg 附件**。

建议在 Release 说明中链接：

- 安装步骤：本文件 **§A**
- 状态与限制：[docs/desktop-app-status.md](../../docs/desktop-app-status.md)

---

## C. Windows — 如何打出 `.exe` 安装包

> **Mac 无法直接生成 Windows 的 `.exe`。** 必须在 **Windows 10/11** 电脑（或 GitHub Actions `windows-latest`）上构建。

### C.1 环境准备（Windows）

1. 安装 **[Node.js 20+](https://nodejs.org/)**
2. 安装 **[Rust](https://www.rust-lang.org/tools/install)**（安装程序会提示装 MSVC）
3. 安装 **Visual Studio Build Tools** 或 Visual Studio，勾选 **「使用 C++ 的桌面开发」**
4. WebView2：Windows 11 通常已带；Win10 需 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)

### C.2 构建命令（与 Mac 相同 npm 脚本）

```powershell
git clone https://github.com/JikerSun/sjk-traffic_lights.git
cd sjk-traffic_lights
npm install
npm run build:desktop
```

`npm run build:desktop` 等价于：

1. `npm run sync:hook-kit` — 复制 `tools/`、`scripts/lib/` 等到 `products/desktop-overlay/src-tauri/resources/hook-kit/`
2. `npm run build:web` — Vite 构建 `setup.html` / `settings.html` / `overlay.html` → `products/desktop-overlay/dist/`
3. `npx tauri build` — Rust release + 打安装包

### C.3 Windows 产物路径

构建成功后（Tauri 2 默认 NSIS）：

```
products/desktop-overlay/src-tauri/target/release/bundle/nsis/
  AI Traffic Lights_0.1.0_x64-setup.exe    （名称以实际为准）

products/desktop-overlay/src-tauri/target/release/
  ai-traffic-lights-desktop.exe            （裸 exe，无安装器）
```

可将 `.exe` 上传到 GitHub Release（例如 `desktop-v0.1.0-windows`）。

### C.4 相关源码（打 exe 时会编译进包）

| 部分 | 路径 |
|------|------|
| Tauri 主程序 | `products/desktop-overlay/src-tauri/src/` |
| 前端 | `products/desktop-overlay/setup.html`、`settings.html`、`overlay.html`、`src/*.ts` |
| Hook 脚本（资源） | `products/desktop-overlay/src-tauri/resources/hook-kit/` |
| Windows 窗口 API | `products/desktop-overlay/src-tauri/src/platform_windows.rs` ⚠️ **当前为 stub** |
| 配置 | `products/desktop-overlay/src-tauri/tauri.conf.json` |

### C.5 Windows 当前限制

- **`platform_windows.rs` 未实现** Cursor 窗口枚举 → 绑窗 / 吸附 / Setup 选窗 **不可用**
- 可先验证：安装、Hook 自装、浮窗显示、菜单
- 完整功能需补 Win32 窗口列表后再发 Windows Release

### C.6 可选：GitHub Actions 自动打 Mac + Windows

可在 `.github/workflows/desktop-release.yml` 增加（尚未提交时可手动在 Windows 机构建）：

- `runs-on: macos-latest` → 上传 `.dmg`
- `runs-on: windows-latest` → 上传 `*-setup.exe`

---

## D. 开发模式（Mac）

```bash
cd sjk-traffic_lights
npm run dev:desktop
```

详见 [docs/desktop-app-testing-mac.md](../../docs/desktop-app-testing-mac.md)

---

## E. 文档索引

| 文档 | 内容 |
|------|------|
| [docs/desktop-app-status.md](../../docs/desktop-app-status.md) | **功能清单 + 已知问题（接续必读）** |
| [docs/desktop-app-requirements.md](../../docs/desktop-app-requirements.md) | 需求全文 |
| [products/desktop-overlay/README.md](../../products/desktop-overlay/README.md) | 源码结构 |
