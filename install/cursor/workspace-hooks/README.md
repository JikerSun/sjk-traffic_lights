# Cursor 项目 Hooks（每个仓库装一次）

将 Agent 状态写入目标项目下的 `.ai-traffic-lights/state.json`，供扩展侧边栏读取。

## 安装

```bash
# 在要启用红绿灯的 Cursor 项目根目录执行：
/path/to/workspace-hooks/bootstrap.sh /path/to/your-project

# 或 cd 到项目根后：
./path/to/workspace-hooks/bootstrap.sh .
```

## 包含内容

- `.cursor/hooks.json`
- `.cursor/hooks/write-bridge-from-hook.mjs`
- `scripts/lib/*.mjs`

## 注意

- 还需安装 [扩展 VSIX](../extension/)（本机一次）。
- 从完整仓库更新本目录：在仓库根执行 `npm run sync:install-kits`。
