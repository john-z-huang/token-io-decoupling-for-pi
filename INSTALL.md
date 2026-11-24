# 安装与更新 Skill

准备 `uv` 和 Python 3.11 或更高版本。从本仓库根目录运行对应宿主的安装或更新命令。

## Pi Coding Agent

```bash
/bin/bash -c 'uv run --locked --script scripts/compile-reference-dsl.py --update-skill' _
```

首次安装和后续更新都使用 Pi 专用目录 `~/.pi/agent/skills/token-io-decoupling-skill/`。可在 Bash 命令的引号内追加 `--name <名称>`，在同一 Pi Skill 根目录下指定安装名称。名称使用小写字母、数字和连字符。

在现有 Pi 会话中执行 `/reload`，或新开会话读取更新后的内容。

## Codex

将路径换成目标项目现有的绝对目录。安装器写入该项目的 `.agents/skills/token-io-decoupling-skill/`。

```bash
/bin/bash -c 'uv run --locked --script scripts/compile-reference-dsl.py --update-skill --host codex --project-root "$1"' _ /absolute/path/to/project
```

从目标项目新开 Codex 会话，可用 `$token-io-decoupling-skill` 显式调用。Pi 也可发现项目的 `.agents/skills/`。在同时使用两个宿主的项目中，可共用该项目安装；若还保留同名 Pi 用户级安装，核对 Pi 实际选中的 Skill 路径和版本。

## 安装保护

更新前校验安装标记及文件指纹。安装器保护未知目录、本地修改、符号链接及作为安装目标的 Git checkout。发布失败且无法自动恢复时，命令会报告保留原安装的备份路径。

两种安装均包含同一份 `SKILL.md`、Hooks、路线和宿主适配。安装命令只发布 Skill。MCP、宿主配置和 Memory 后端由当前宿主另行管理，使用前按适配说明核对已获准的能力。

## 项目 Memory 接入

- **Pi** 使用已获准的 Pi MCP 或扩展。先确认服务绑定当前项目，且宿主能按需发现并调用工具。仅有服务名称时继续核对实际暴露能力。
- **Codex** 使用已获准的 Codex Memory 后端。采用 Serena 时，可由宿主将服务绑定到目标项目，并用其 `--agent-interface tools` 选项暴露专用操作。只读场景可在 Codex MCP 配置中用 `enabled_tools` 限定项目绑定和读取能力。若通用接口需要额外审批，按实际审批处理。

两个宿主可以接入同一个获准的后端。共享计划的仓库身份、逻辑名称、读写授权和归档验证使用同一份规则；只读连接只覆盖读取及其证据。
