# 外部参考资料


本索引仅供开发和维护 `token-io-decoupling` Skill 时查阅。它是来源目录，不是执行指导。普通 Coding 任务不应加载本索引；Coding 工作流不依赖它。

| 来源 | URL | 对应文档 | 开发用途与边界 |
| --- | --- | --- | --- |
| Pi 官方文档 | https://github.com/earendil-works/pi | [Pi 运行时与能力边界](../skill/references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md) | 核对 Skill 按需加载、MCP 工具发现和宿主能力边界；当前支持情况以实际 Pi 客户端为准。 |
| Serena Memory 发现与读取 | https://raw.githubusercontent.com/oraios/serena/main/docs/02-usage/045_memories.md | [Serena 工具](../skill/references/coding/layer-01-fundamental-concepts/session-runtime/LSP-MCP-Tools.md)、[任务计划生命周期](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md) | Issue #189：核对按名称主动选择读取及主题发现；区分工具执行确认和必需的内容验证，避免重复输出全文。 |
| Serena Memory 维护门槛 | https://raw.githubusercontent.com/oraios/serena/main/src/serena/resources/memory_maintenance.md | [Serena 工具](../skill/references/coding/layer-01-fundamental-concepts/session-runtime/LSP-MCP-Tools.md)、[任务计划生命周期](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md) | Issue #189：区分稳定可复用知识与本 Skill 单独管理的任务计划和 Worker 记录；避免逐命令持久化。 |
| Git canonical 共同目录 | https://git-scm.com/docs/git-rev-parse | [任务计划生命周期](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md) | 核对用于带版本本机仓库 key 的绝对 checkout/共同目录解析；不得从 worktree basename、分支、remote URL 或 HEAD 派生。 |
| Git linked-worktree 仓库布局 | https://git-scm.com/docs/gitrepository-layout | [任务计划生命周期](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md) | 核对 commondir 共享及主仓库与 worktree 专属管理目录的区别，说明搬迁及独立 clone 的身份边界。 |
| OpenAI Decisions | https://developers.openai.com/api/docs/guides/decisions | [工作流架构](WORKFLOW_ARCHITECTURE.md) | 核验可选语义判断的类型化选项请求及拒绝响应；此引用不授权真实请求。 |
| OpenAI Python Decisions 参考 | https://developers.openai.com/api/reference/python/resources/decisions/methods/create | [Decisions 建议](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/decisions-advisory.md) | 核验可选建议的 SDK 请求、固定选项响应及拒绝契约；本地配置、授权和最终判断仍为独立要求。 |
| uv 本地依赖缓存 | https://docs.astral.sh/uv/concepts/cache/ | [安装与更新](../INSTALL.md) | 核对 Skill 编译器的依赖缓存与离线构建条件。 |
| OpenAI Decisions 创建接口 | https://developers.openai.com/api/reference/resources/decisions/methods/create | [运行环境与模型支持](../skill/references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md) | 核验子代理强度选择的 choice 请求、answers 中的 choice/refusal、固定 API 模型及输出边界；不授权创建 Agent。 |
| Serena MemoryManager 实现 | https://github.com/oraios/serena/blob/main/src/serena/memories/memory_manager.py | [任务计划生命周期](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md) | 核实规范 Memory 路径、ignored/read-only 策略检查、原子保存和不传播引用的移动边界；这些行为不能代替对当前权限和读回证据的核验。 |
| Serena Memory API 实现 | https://github.com/oraios/serena/blob/main/src/serena/repl/api/mem_api.py | [任务计划生命周期](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md)、[Serena 工具](../skill/references/coding/layer-01-fundamental-concepts/session-runtime/LSP-MCP-Tools.md) | 核实全文读取、简短写入回执，以及 `max_chars` 限制提交的写入内容而非读取输出。通用重命名会传播引用；这些操作都不构成受保护事务。 |
| OpenAI Structured Outputs | https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses | [工作流路由建议](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/workflow-routing-advice.md)、[输出物化](../skill/references/coding/layer-01-fundamental-concepts/execution-planning/output-materialization.md) | 核验可选建议和已提供事实排序相关的有界结构化响应行为；不得将 API 输出当作授权。 |
