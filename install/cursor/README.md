# Cursor 安装

## 推荐流程（所有项目生效）

1. **全局 Hooks（本机一次）** → [global-hooks/](global-hooks/)  
   `npm run install:global-hooks`
2. **扩展（本机一次）** → [extension/](extension/)  
   VSIX 或 `npm run install:cursor-extension:local`

Reload Window 后，打开任意项目根目录即可。

## 备用：仅一个项目

[workspace-hooks/bootstrap.sh](workspace-hooks/bootstrap.sh) — 无需全局安装时使用。
