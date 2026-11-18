# 工作流架构


本文档说明 **Pi 宿主侧有状态流程引擎** 和 **MCP 通用工具服务中的无状态规则接口**。参考规则由 YAML DSL owner 定义，操作权限依用户授权和宿主守卫核验。

## Pi 宿主侧 Extension 与 Hooks

入口为 `extensions/coding-workflow/index.ts`。`catalog.ts` 核对 Layer-04 的阶段与 Hook 绑定以及检查点形状；`engine.ts` 维护七模块顺序、当前位置、模式/预算、Slice、三维 epoch、修复与恢复回环；`runtime.ts` 将真实 Pi 事件接到状态机及条件 Hook 包，工具调用仍经实际 `ctx.executeTool` 的宿主校验/权限链。

Extension 状态使用实际 Pi Session 的 custom entry，不是 Memory 后端、服务端数据库或原子事务。按当前对话分支恢复位置，同时保留整个 Session 已绑定的子任务名额；树导航不会回退磁盘效果。每次模型请求注入当前检查点全文、后续目录以及适用的 [Hook 合同](hooks/README.md)；源码/规则 Hash 变化要求重新核验。

可观察事件自动处理；需求变化、独立性、修复范围、文档影响等语义判断由 Agent 通过结构化信号报告。顺序、字段、引用、预算、路径和 epoch 可以守卫，授权、事实真实性、验证充分性和语义验收仍须独立判断。该扩展不是 OS 沙箱，也不自动证明不透明命令的副作用分类。

[使用与限制](PI_EXTENSION.md)说明安装、一次性子代理适配、有限续跑、离线测试与未验收事项。旧 Skill-only CLI 不安装此 Extension。

当前单一 `token-io-decoupling-tools` 服务提供 stdio 和 Skill 安装/更新入口。宿主的工具发现、只读服务可用性、可信绑定和具体操作授权分别核验。结构检查覆盖其声明的规则和输入范围。

## MCP 规则与通用工具

MCP 的 `rules_get_context` 提供有界规则读取，`validate_decoupling_compliance` 对候选内容做结构预检。检查点报告及推进由宿主 Extension 处理。规则文档仍具权威性。工具结果、Hash 和调用方声明不能认证调用方、证明权限或来源、判定语义真实性、通过检查点、建立跨调用顺序或验收工作。调用方必须阅读当前 owner、独立解释证据，并在实际宿主 Session 中回读控制记录，在父级对话中保留必要的语义来源。

规则读取与结构检查路径无需 SQLite 数据库、API 凭据或网络请求。可选语义建议可以依据开发指南中的独立 API 授权和凭据规则，发送显式配置的 API 请求；其结果仍仅供建议，不能授权工作。MCP 仅保留 `token-io-decoupling-tools`；其支持的客户端及工具清单见[MCP 开发指南](../project/mcp/DEVELOPMENT.md)。

## 受保护的输出物化

可选输出物化操作独立于工作流评估。它需要由可信启动配置注入的授权 provider，提供当前 Worker 绑定和 assignment 上下文；另须提供独立 grant 并通过既有的逐次调用检查。工具调用方不能选择或提供该 provider 上下文。当前没有标准 provider；未显式配置可信 provider 和 grant 时，此能力不可用。应用请求范围不等于宿主认证。[输出物化](references/coding/layer-01-fundamental-concepts/execution-planning/output-materialization.md) owner 仍负责准备、全新预检、manifest 检查和写入时重新授权。

## 实现包

MCP workspace 包含独立构建的 `core`、`transport` 和 `tools` 分发包。Core 负责稳定契约、清单、只读规则和打包资源；transport 负责 MCP 注册、请求范围和 schema；tools 提供通用工具及可选物化服务。根分发包仅提供一个 `token-io-decoupling-tools` CLI，兼具 stdio 与 Skill 安装更新命令；workflow 专属调度、评估、决策和 task-plan 实现已移除。[开发指南](../project/mcp/DEVELOPMENT.md)负责当前工具数量、包命令、构建和验证流程。

```mermaid
flowchart TD
    Root[根 CLI 与服务组装] --> Core[Core 契约和规则资源]
    Root --> Transport[Transport MCP 注册]
    Root --> Tools[通用工具与输出物化]
    Transport --> Core
    Tools --> Transport
    Tools --> Core
```

## API 与数据边界

每个可选 OpenAI API 请求都必须使用开发指南指定的必需进程环境值和固定模型。配置缺失时必须在发出请求前失败。规则读取、导航和结构预检工具不持久化 Session/工作流状态，也不创建或派发 Agent；MCP 同一 CLI 还注册通用 Git、仓库及托管平台工具，它们可能执行受各自守卫约束的 Git 或远端操作，不应把规则工具的无状态边界套用到全部工具。输出物化是另一项独立的受保护能力；缺少可信启动配置时仍不可用。

MCP 规则注册表和片段索引绑定 DSL owner 的 Markdown 导出路径和标题。源码读取与打包摘录使用同一份导出及同一语言。上下文 Hash 标识返回文本。结构评估只检查声明的输入结构和规则兼容性，返回的审阅状态仍须由 Agent 对照 owner 和证据解释。

## 相关概念

- [工作流规则上下文](references/coding/layer-01-fundamental-concepts/workflow-navigation/rule-context.md) — 有界查找和所供事实结构检查。
- [工作流导航可用性](references/coding/layer-01-fundamental-concepts/workflow-navigation/navigation-availability.md) — 直接读取 owner 的回退和不可用处置。
- [Coding Delegation State Record](references/coding/layer-01-fundamental-concepts/delegation/delegation-state-record.md) — 父级控制任务记录。
- [Output Materialization](references/coding/layer-01-fundamental-concepts/execution-planning/output-materialization.md) — 独立守卫的输出写入。
- [Coding 工作流选择器](workflows/coding.md) — 路线导航。
