# Cursor 扩展（VSIX）

## 方式 A：GitHub Release（推荐）

1. 打开 [Releases](https://github.com/JikerSun/sjk-traffic_lights/releases)
2. 下载 **`ai-traffic-lights-cursor.vsix`**
3. Cursor → `Cmd+Shift+P` → **Extensions: Install from VSIX...**
4. **Reload Window**

还需安装全局 Hooks，见 [global-hooks/README.md](../global-hooks/README.md) 或仓库根 [README.md](../../../README.md)。

## 方式 B：在本仓库构建

```bash
npm run package:extension
```

生成：**本目录** `ai-traffic-lights-cursor.vsix`（不提交 git，请上传到 Release）。

## 方式 C：开发者本地安装

```bash
npm run install:cursor-extension:local
```

然后 Reload Window。
