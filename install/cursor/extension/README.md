# Cursor 扩展（VSIX）

## 方式 A：GitHub Release（推荐）

1. 打开 [Releases](https://github.com/JikerSun/sjk-traffic_lights/releases)
2. 下载 `ai-traffic-lights-cursor.vsix` 到本目录或任意位置
3. Cursor → `Cmd+Shift+P` → **Extensions: Install from VSIX...**
4. **Reload Window**

## 方式 B：在本仓库构建

```bash
cd /path/to/sjk-traffic_lights
npm install
npm run package:extension
```

生成文件：**本目录**下的 `ai-traffic-lights-cursor.vsix`。

## 方式 C：开发者本地安装

```bash
npm run install:cursor-extension:local
```

然后 Reload Window。
