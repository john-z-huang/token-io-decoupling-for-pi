# 安装与更新 Skill

准备 `uv` 和 Python 3.11 或更高版本。从仓库根目录运行同一个命令完成首次安装或后续更新。

```bash
/bin/bash -c 'uv run --locked --script scripts/compile-reference-dsl.py --update-skill'
```

首次安装写入 `~/.agents/skills/token-io-decoupling-skill/`。已有旧版受管理安装时，在原 `~/.pi/agent/skills/` 路径更新。可在命令末尾追加 `--name <名称>`，使用小写字母、数字和连字符指定受管理的安装。

更新前校验安装标记及文件指纹，拒绝覆盖未知目录、本地修改、符号链接和 Git checkout。两个 Skill 根下都存在同名安装时，先核实保留哪一份。发布失败且无法自动恢复时，命令会报告保留原安装的备份路径。

安装后的目录包含 `SKILL.md`、Hooks、路线和参考规则。Pi 已加载的会话需执行 `/reload` 或新开会话以读取更新后的内容。

需要项目 Memory 只读工具时，按 [dev-workflow-standards 安装说明](https://github.com/john-z-huang/dev-workflow-standards/blob/main/INSTALL.md) 独立配置其 MCP 服务。两个 Memory 工具只读取 MCP 启动项目的 `.serena/memories/`。
