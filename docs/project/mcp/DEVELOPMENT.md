# MCP 开发指南

服务面向 Pi Coding Agent，仅提供 `token-io-decoupling-tools` 一个可执行程序。无参数启动 stdio；`--help`、`--version` 为诊断入口，`skills install` / `skills update` 管理 Skill。

## 安装与更新

在仓库根目录执行 `bash scripts/install-pi-mcp.sh`，使用 uv tool 安装 workspace 构建出的本地 wheel。脚本不写入宿主配置、不启动 API 调用，也不自动安装 Skill。

```sh
token-io-decoupling-tools skills install
token-io-decoupling-tools skills update
```

默认目录 `~/.pi/agent/skills/token-io-decoupling-skill/`，安装后在 Pi 执行 `/reload`。更新包后再显式更新 Skill 快照；不会覆盖本地修改或迁移旧目录。

## 工具边界

34 个工具的权威清单为 `mcp/packages/token_io_decoupling_core/src/token_io_decoupling_core/server_tools.py`。包括 Git/GitHub 操作、通用内容生成与输入检查，以及规则上下文查询、合规预检、Serena Memory 检查和输出材料化；不暴露 Codex 专用会话事实与会话决策工具。

原 MCP workflow 调度、checkpoint 评估、模型/执行者/子代理选择及 task-plan 生命周期已删除。Pi Extension 的宿主流程独立保留；规则查询只读、不执行流程。上游带 workflow 名称的通用内容建议工具不管理本项目的流程状态。

### 调用方上下文

可选的请求上下文匹配仅在显式启用并注入可信 `BindingProvider` 时运行；请求元数据中的 `threadId` 必须与当前已验证会话 ID 一致。其他元数据不选择身份、角色或授权。标准 stdio 启动及工具发现本身不建立可信绑定。详见[调用方上下文与受保护能力](CALLER_CONTEXT.md)。

## 包结构与验证

`core` 保存基础契约与只读规则资源；`transport` 负责注册；`tools` 保存通用服务；根分发包保存唯一 CLI、服务组装和 Skill 安装器。

```sh
cd mcp
uv sync --group dev
uv run pytest tests/unit_tests tests/mock_api_tests
uv run ruff check src packages tests
uv build --all-packages --wheel
```

不默认运行真实 API。材料化保留可信身份、授权、路径和预检限制；Pi stdio 的连接或环境变量不会自动授予这些能力。内部 API 调用需要实际进程中的凭据，不能输出凭据或擅自外发内容。
