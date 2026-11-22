# 安装与更新 Skill

准备 `uv` 和 Python 3.11 或更高版本。从仓库根目录运行同一个命令完成首次安装或后续更新。

```bash
/bin/bash -c 'uv run --locked --script scripts/compile-reference-dsl.py --update-skill'
```

首次安装和后续更新都使用 Pi 专用目录 `~/.pi/agent/skills/token-io-decoupling-skill/`。可在 Bash 命令的引号内追加 `--name <名称>`，在同一 Pi Skill 根目录下指定安装名称。名称使用小写字母、数字和连字符。

更新前校验安装标记及文件指纹，拒绝覆盖未知目录、本地修改、符号链接和 Git checkout。发布失败且无法自动恢复时，命令会报告保留原安装的备份路径。

安装后的目录包含 `SKILL.md`、Hooks、路线和参考规则。在现有 Pi 会话中执行 `/reload`，或新开会话读取更新后的内容。
