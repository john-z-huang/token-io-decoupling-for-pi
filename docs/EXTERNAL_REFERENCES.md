# 外部参考资料


本索引仅供开发和维护 `token-io-decoupling` Skill 时查阅。它是来源目录，不是执行指导。普通 Coding 任务不应加载本索引；Coding 工作流不依赖它。

| 来源 | URL | 对应文档 | 开发用途与边界 |
| --- | --- | --- | --- |
| Pi 官方文档与本地安装快照 | https://github.com/earendil-works/pi | [Pi 运行时与能力边界](../skill/references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md) | 本次以本机已安装 Pi 1.5.2 的 README、`docs/skills.md`、`docs/mcp.md` 及 CLI 参数说明为证据，核对按需加载、MCP 工具发现、扩展边界与 thinking 控制；不将扩展子代理视为内置能力，不声称本项目 MCP 已完成 Pi 接入。 |
| Serena Memory 发现与读取 | https://raw.githubusercontent.com/oraios/serena/main/docs/02-usage/045_memories.md | [Serena 工具](../skill/references/coding/layer-01-fundamental-concepts/session-runtime/LSP-MCP-Tools.md)、[任务计划生命周期](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md) | Issue #189：核对按名称主动选择读取及主题发现；区分工具执行确认和必需的内容验证，避免重复输出全文。 |
| Serena Memory 维护门槛 | https://raw.githubusercontent.com/oraios/serena/main/src/serena/resources/memory_maintenance.md | [Serena 工具](../skill/references/coding/layer-01-fundamental-concepts/session-runtime/LSP-MCP-Tools.md)、[任务计划生命周期](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md) | Issue #189：区分稳定可复用知识与本 Skill 单独管理的任务计划和 Worker 记录；避免逐命令持久化。 |
| Git canonical 共同目录 | https://git-scm.com/docs/git-rev-parse | [任务计划生命周期](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md)、[任务计划工具](mcp/TASK_PLAN_TOOLS.md) | 核对用于带版本本机仓库 key 的绝对 checkout/共同目录解析；不得从 worktree basename、分支、remote URL 或 HEAD 派生。 |
| Git linked-worktree 仓库布局 | https://git-scm.com/docs/gitrepository-layout | [任务计划生命周期](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md)、[任务计划工具](mcp/TASK_PLAN_TOOLS.md) | 核对 commondir 共享及主仓库与 worktree 专属管理目录的区别，说明搬迁及独立 clone 的身份边界。 |
| MCP Python SDK v2 | https://py.sdk.modelcontextprotocol.io/whats-new/ | [增强架构](WORKFLOW_ARCHITECTURE.md) | 核验 v2 服务端/客户端 API，并区分协议修订与包版本。 |
| MCP SDK 测试 | https://py.sdk.modelcontextprotocol.io/get-started/testing/ | [增强架构](WORKFLOW_ARCHITECTURE.md) | 设计内存行为测试；它们不能证明任一宿主客户端的兼容性或线上传输交换。 |
| MCP 协议版本 | https://py.sdk.modelcontextprotocol.io/protocol-versions/ | [增强架构](WORKFLOW_ARCHITECTURE.md) | 独立核验现代协议发现与版本证据，不依赖 SDK 主版本标签。 |
| MCP 客户端传输 | https://py.sdk.modelcontextprotocol.io/client/transports/ | [增强架构](WORKFLOW_ARCHITECTURE.md) | 核验子进程 stdio 测试，不使用 GUI 交互或额外 Agent Session。 |
| MCP 传输授权 | https://py.sdk.modelcontextprotocol.io/run/authorization/ | [增强架构](WORKFLOW_ARCHITECTURE.md) | 核验 HTTP 令牌校验不能认证 stdio 或进程内客户端；要求独立的可信启动边界。 |
| OpenAI Decisions | https://developers.openai.com/api/docs/guides/decisions | [增强架构](WORKFLOW_ARCHITECTURE.md) | 核验可选语义判断的类型化选项请求及拒绝响应；此引用不授权真实请求。 |
| OpenAI Python Decisions 参考 | https://developers.openai.com/api/reference/python/resources/decisions/methods/create | [Decisions 建议](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/decisions-advisory.md) | 核验可选建议的 SDK 请求、固定选项响应及拒绝契约；本地配置、授权和最终判断仍为独立要求。 |
| uv GitHub Actions 集成 | https://docs.astral.sh/uv/guides/integration/github/ | [MCP 开发](mcp/DEVELOPMENT.md) | 核验 CI 中固定版本的 uv 配置、托管 Python 矩阵与锁定依赖安装；工作流实际运行与本地检查属于不同证据。 |
| Linux Unix domain socket 凭据 | https://man7.org/linux/man-pages/man7/unix.7.html | [MCP 开发](mcp/DEVELOPMENT.md) | 核验继承的特权宿主通道所使用的内核对端凭据；不据此证明运行时 Session 映射或操作守卫。 |
| Apple 对端凭据 | https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man3/getpeereid.3.html | [MCP 开发](mcp/DEVELOPMENT.md) | 独立核验原生 macOS 对端凭据认证，不假设 Python socket API 暴露相同能力。 |
| TOML Kit 解析与文档编辑 | https://tomlkit.readthedocs.io/en/latest/quickstart/ | [MCP 开发](mcp/DEVELOPMENT.md#工具边界) | 核验 `parse`/`dumps` 及保留风格的文档编辑；针对锁定包版本的本地测试另行检查定向合并、错误处理和文件写入行为。 |
| TOML Kit 格式限制 | https://github.com/python-poetry/tomlkit/blob/master/README.md | [MCP 开发](mcp/DEVELOPMENT.md#工具边界) | 本地缓存的上游 README 指出了乱序数组子表的规范化行为；针对锁定版本复现，并在写入前拒绝意外的排版变化。 |
| uv workspace | https://docs.astral.sh/uv/concepts/projects/workspaces/ | [实现包](WORKFLOW_ARCHITECTURE.md#实现包) | 核验独立成员元数据、继承的 workspace sources 与共享 lockfile；源码根项目的 tool 安装另行验证。 |
| uv tool 环境 | https://docs.astral.sh/uv/concepts/tools/ | [MCP 开发](mcp/DEVELOPMENT.md) | 核验已安装可执行程序的环境、本地工具安装，以及统一入口的依赖/可执行程序边界。 |
| uv tool 命令参考 | https://docs.astral.sh/uv/reference/cli/#uv-tool-install | [MCP 开发](mcp/DEVELOPMENT.md#安装与更新) | 核验单次调用安装入口使用 `--force` 安装工具、选择托管 Python，并通过 `uv tool dir --bin` 定位入口，无须将其目录加入 PATH。 |
| uv 本地依赖缓存 | https://docs.astral.sh/uv/concepts/cache/ | [MCP 开发](mcp/DEVELOPMENT.md#安装与更新) | 核验安装入口为何同时使用 `--reinstall`，确保只修改源码或规则资源后也会更新本地 workspace 依赖。 |
| OpenAI Decisions 创建接口 | https://developers.openai.com/api/reference/resources/decisions/methods/create | [运行环境与模型支持](../skill/references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md) | 核验子代理强度选择的 choice 请求、answers 中的 choice/refusal、固定 API 模型及输出边界；不授权创建 Agent。 |
| Serena MemoryManager 实现 | https://github.com/oraios/serena/blob/main/src/serena/memories/memory_manager.py | [任务计划生命周期](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md)、[MCP 开发](mcp/DEVELOPMENT.md) | 核实规范 Memory 路径、ignored/read-only 策略检查、原子保存和不传播引用的移动边界；适配器须自行补充版本、锁、禁止覆盖和读回检查。本机安装版 2.1.0 观察与持续变化的上游源码分别作为证据。 |
| Serena Memory API 实现 | https://github.com/oraios/serena/blob/main/src/serena/repl/api/mem_api.py | [任务计划生命周期](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md)、[Serena 工具](../skill/references/coding/layer-01-fundamental-concepts/session-runtime/LSP-MCP-Tools.md) | 核实全文读取、简短写入回执，以及 `max_chars` 限制提交的写入内容而非读取输出。通用重命名会传播引用；这些操作都不构成受保护事务。 |
| Serena 配置实现 | https://github.com/oraios/serena/blob/main/src/serena/config/serena_config.py | [MCP 开发](mcp/DEVELOPMENT.md) | 核实常规配置加载可能迁移、创建配置或改变其权限；要求显式 manager/factory 注入，不在能力发现时自动加载配置。 |
| OpenAI Structured Outputs | https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses | [工作流路由建议](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/workflow-routing-advice.md)、[输出物化](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/output-materialization.md) | 核验可选建议和已提供事实排序相关的有界结构化响应行为；不得将 API 输出当作授权。 |
