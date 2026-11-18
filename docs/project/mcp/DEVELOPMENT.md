# MCP 开发指南

服务面向 Pi Coding Agent，仅提供 `token-io-decoupling-tools` 一个可执行程序。无参数启动 stdio；`--help`、`--version` 为诊断入口，`skills install` / `skills update` 管理 Skill。

## 安装与更新

在仓库根目录执行 `bash scripts/update-pi-tools-and-skill.sh`，按顺序构建 Skill、构建 MCP wheel、安装或更新 MCP 工具并同步本地 Skill。只安装或更新 MCP 工具时，执行 `bash scripts/install-pi-mcp.sh`。脚本不改宿主配置，也不调用模型 API。 [安装与使用](../../../INSTALL.md)

也可以分别执行首次安装或后续更新命令。

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

`core` 保存基础契约与只读规则资源；`transport` 提供统一注册机制；`tools` 保存通用服务与按服务器绑定的 callback；根分发包保存唯一 CLI、服务组装、集中工具定义和 Skill 安装器。

### 固定工具模板与集中注册

所有工具使用 `token_io_decoupling_transport.registration.ToolDefinition` 模板，由 `mcp/src/token_io_decoupling/tool_registry.py` 中的 `tool_definitions()` 集中声明，`register_tools()` 先校验完整清单，再逐项调用唯一的 `ToolRegistrar.register()`。`server.py` 只负责组装服务；业务模块不调用 MCP 装饰器，上游依赖只提供业务 callback 和说明元数据，不再通过其 `register_*` 注册工具。

初始化响应只携带 Pi 服务共用的调用边界。单项工具的参数、返回值和副作用以实际发现的元数据为准。服务器在 SDK 调用边界统一屏蔽参数校验错误中的输入值。

新增或调整工具时，统一使用以下模板（字段按既有调用契约选择）：

```python
ToolDefinition(
    name="tool_name",
    callback=callback,
    description="工具的用途、输入、输出与安全边界说明",
    annotations=annotations,
    parameter_descriptions=parameter_descriptions,
    payload_type=None,
    enhanced=False,
    role=None,
    structured_output=None,
)
```

- 平铺参数工具：`payload_type=None`，从 callback 的类型签名保留参数、默认值和校验；`parameter_descriptions` 如提供，必须与全部参数名严格对应。Memory 工具保留严格类型约束与只读 annotations。
- payload 工具：设置 Pydantic `payload_type`，保持 `payload` envelope 和 JSON 校验。受保护材料化必须设置 `enhanced=True, role="worker"`，保留可信请求上下文、角色和授权检查；普通平铺工具不引入该绑定机制。
- `structured_output=None` 保持 SDK 自动推断，现有本地工具使用 `False`。模板统一不意味着改变现有 wire 格式、返回值或错误脱敏规则。
- 清单必须与 `core/server_tools.py` 完全一致；未知名称、重复定义和清单漂移会报错，不允许静默过滤。调整公开清单属于接口变更，不能只改注册文件绕过契约。
- `tests/unit_tests/test_tool_registry.py` 将 34 项完整发现元数据与改前 fixture 比对，并检查注册失败、参数说明和多服务器配置隔离。不要为让测试通过而盲目重生成 fixture；有意接口变更应单独审阅。

在仓库根目录开始。先生成源码规则查询和测试所需的 `docs/skill/`，避免在依赖已缓存、`uv sync` 未重新构建包时缺少产物。

```sh
uv run --locked --script scripts/compile-reference-dsl.py
cd mcp
uv sync --group dev
uv run pytest tests/unit_tests tests/mock_api_tests
uv run ruff check src packages tests
uv build --all-packages --wheel
```

从仓库构建 MCP 包时，构建钩子先从 `docs/rules/` 生成 Skill 文档和规则摘录。独立源码分发包携带构建所需的快照。

不默认运行真实 API。材料化保留可信身份、授权、路径和预检限制；Pi stdio 的连接或环境变量不会自动授予这些能力。内部 API 调用需要实际进程中的凭据，不能输出凭据或擅自外发内容。
