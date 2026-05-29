# 全局 Hooks（推荐：所有 Cursor 项目自动变灯）

一次安装到用户目录，**任意**用 Cursor 打开的项目文件夹都会触发红绿灯逻辑，无需每个仓库再 `bootstrap`。

## 安装

在工具仓库根目录：

```bash
npm run install:global-hooks
npm run install:cursor-extension:local   # 或安装 VSIX
```

然后 **Reload Window**。

## 状态文件位置

按工作区隔离（避免多项目串灯）：

`~/.cursor/ai-traffic-lights/states/<workspace-id>/state.json`

## 卸载（彻底）

```bash
npm run uninstall:global-hooks          # 删除 ~/.cursor/ai-traffic-lights 与 hooks.json 中本工具条目
npm run uninstall:cursor-extension      # 删除本机扩展目录
```

在 Cursor 里也可：**Extensions → AI Traffic Lights → Uninstall**，再 Reload。

若曾 `bootstrap` 过单个项目，可手动删除该项目下的 `.cursor/hooks` 相关条目与 `scripts/lib` 拷贝（可选）。
