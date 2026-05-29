---
name: push-sjk-traffic-lights
description: >-
  将 sjk-traffic_lights（AI Traffic Lights）仓库的本地改动提交并推送到 GitHub
  origin/main。用于用户说推送代码、上传 GitHub、提交并 push、发版到 git、更新远程仓库，
  或 @push-sjk-traffic-lights / traffic lights 推代码 时。仓库 JikerSun/sjk-traffic_lights，SSH。
---

# 推送 sjk-traffic_lights 到 GitHub

## 仓库常量

| 项 | 值 |
|----|-----|
| 本地路径 | `/Users/jakiesun/Desktop/sjk-traffic_lights` |
| 远程 | `git@github.com:JikerSun/sjk-traffic_lights.git` |
| 默认分支 | `main` |
| 网页 | https://github.com/JikerSun/sjk-traffic_lights |

执行前确认 `git remote get-url origin` 匹配上表；若在其它目录，先 `cd` 到本地路径。

## 用户意图

| 用户说法 | 行为 |
|----------|------|
| 推送 / 上传 / 同步 GitHub（默认） | 有改动 → 提交 + `git push` |
| 只 push / 已提交过 | 仅 `git push origin main` |
| 不要提交 / 只看 diff | 只 `status` + `diff`，不 commit |
| 不要 push | 只 commit，不 push |

调用本 skill 且未特别声明「不要提交」时，视为用户授权 **commit + push**（仍遵守下方禁止项）。

## 禁止（必须遵守）

- 不要向用户索要密码、SSH 私钥、Token 全文
- 不要 `git push --force`（除非用户明确要求）
- 不要 `git commit --amend`（除非用户明确要求且符合 amend 规则）
- 不要改 `git config`
- 不要提交：`.env`、密钥、`node_modules`、`dist`、`*.vsix`、`coverage`、`.DS_Store`
- 不要提交运行时桥接产物（见 `.gitignore` 中 `.ai-traffic-lights/` 条目）

## 工作流

复制进度（回复中可勾选汇报）：

```
- [ ] 1. 确认仓库与分支
- [ ] 2. status + diff（含 staged）
- [ ] 3. 清理不应提交的文件
- [ ] 4. 暂存与提交
- [ ] 5. push 并验证
```

### 1. 确认仓库

```bash
cd /Users/jakiesun/Desktop/sjk-traffic_lights
git rev-parse --show-toplevel
git branch --show-current
git remote -v
```

分支应为 `main`；`origin` 应指向 `JikerSun/sjk-traffic_lights`。

### 2. 查看改动

并行或顺序执行：

```bash
git status
git diff
git diff --staged
git log -3 --oneline
```

### 3. 清理不应提交的内容

**仅修改了运行时文件时**：恢复，不纳入本次提交：

```bash
git restore -- '**/.ai-traffic-lights/state.json' '**/.ai-traffic-lights/*.log' 2>/dev/null || true
git restore apps/desktop-overlay/public/.ai-traffic-lights/state.json 2>/dev/null || true
```

若误 `git add` 了 `node_modules`、`*.vsix`、日志： `git restore --staged <path>` 并从暂存区移除。

**无实质代码改动**（仅 runtime / 空树）：告知用户「没有需要推送的改动」，结束。

**扩展有功能变更时**（可选）：检查 `apps/cursor-extension/package.json` 的 `version` 是否已 bump；未 bump 可在 commit 中一并提升 patch 版本。

### 4. 提交

根据 diff 写 **1–2 句英文或中文** commit message，类型参考：

| type | 用途 |
|------|------|
| feat | 新功能 |
| fix | Bug 修复 |
| docs | 文档 |
| chore | 脚本、依赖、工具 |
| refactor | 重构 |

```bash
git add -A
# 再次 git status，确认无禁止文件
git commit -m "$(cat <<'EOF'
feat: 简短说明（为何改）

EOF
)"
```

`git add -A` 后若 staged 含禁止路径，改为按路径 `git add` 具体文件。

### 5. 推送与验证

```bash
git push -u origin main
git status
```

成功则回复：**仓库链接** + 本次 commit 摘要（hash + message）。

### 推送失败

| 错误 | 处理 |
|------|------|
| `Permission denied (publickey)` | 提示用户本机执行 `ssh -T git@github.com`；必要时 `gh auth login` |
| `rejected` / non-fast-forward | 先 `git pull --rebase origin main`，解决冲突后再 push；不要 force |
| `gh: command not found` | 用 `git push` 即可（已配置 SSH） |

## 提交信息示例

```
feat(extension): v4.7 精简 hooks，扩展仅读 state.json

fix(bridge): stop(completed) 时稳定进入 DONE，避免误闪黄灯

docs: 补充分发与运行时说明
```

## 可选：发 Release 包

用户提到发版 / VSIX 时，在 push 之后：

```bash
npm run package:extension
```

将 `apps/cursor-extension/*.vsix` 上传到 GitHub Releases（`gh release create`），**不要**把 `.vsix` 提交进 git。

## 完成后回复模板

```markdown
已推送到 https://github.com/JikerSun/sjk-traffic_lights

- 分支：main
- 提交：<hash> — <message>
- 变更概要：（1–3 条 bullet）
```
