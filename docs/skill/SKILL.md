---
name: token-io-decoupling-skill
description: "用于代码理解、实现、重构、调试、验证、文档和 Git 工作的 Coding 调度入口。优先消费已启用的 Pi Coding Workflow Extension 与条件 Hooks；未启用时按中文 owner 执行单代理或多代理路线。MCP Server 的 Pi 接入另行迁移。"
---

# Token I/O Decoupling

把语义决策与高体量状态消费、输出物化分离。当前仅维护 Coding 可执行工作流；Multimodal/Mixed 仅为参考。

## 从这里开始

### 已启用 Coding Extension

1. 以每次上下文中最新的 **Coding Hooks、revision 和当前检查点**为准；不要再读取整条路线或预加载全部 references，也不要在扩展之外维护第二份流程状态。
2. 消费当前模块清单与自动注入的 Hook，执行已授权工作，用 `coding_checkpoint` 上报真实证据；同模块连续已完成项可批量上报，不能跨模块跳步。
3. 写前使用 `coding_slice` 放行目标、精确路径/影响、返回条件及未放行边界。不透明工具通过 `coding_run` 显式分类影响；真实一次性子任务通过 `coding_delegate` 核验职责/预算和实际 Schema。
4. 语义变化使用结构化 signal，缺前置/授权/能力使用 pause/blocked；恢复只回原位置，不重放效果。Hook 未覆盖的具体边界、歧义或冲突，定向查详细 owner；省略不构成豁免。

工具出现不表示已启用。未见当前 Coding Hooks 时，不由 Agent 猜模式或自行调用命令；用户可用 `/coding single <任务>` 或 `/coding multi [数量] <任务>` 显式启用。安装与能力边界见 [Pi Extension 使用说明](PI_EXTENSION.md)。

### 未启用 Extension 的回退入口

读取 [Coding selector](workflows/coding.md)，依次建立 Contract、Environment/能力清单、Mode 与 Route Entry，按其选择的单代理或多代理路线执行。沿用 [模式 owner](references/coding/layer-01-fundamental-concepts/delegation/delegation-mode-confirmation.md) 的用户选择、四项菜单、默认 Multi/count=1 和会话锁定规则；缺少扩展不授权创建代理，也不免除必需门禁。

## 始终有效

- Root 亲自确认指令、环境、相关代码事实、决策、授权与最终验收；工具、计划、Hash、结构检查和扩展状态均不证明语义正确或授予权限。
- 绝对禁止 Computer Use：不得用 GUI 控制、鼠标/键盘模拟、为操作控件的截图、辅助功能、窗口/远程桌面自动化，或将其包装为 API、CLI、MCP/子代理绕过。其他真实可用且已授权能力不因本黑名单被禁止。
- 每项 Coding 默认遵循[共享任务计划生命周期](references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md)：实施/派发前使用获准 Memory、核验 scope/仓库 key、维护累积内容与单写者协调、完成后保全归档；只有用户或更高优先级明确禁止持久化才有例外。能力缺失不是例外，不能回退普通文件。
- mode/count/allocation/当前 Slice 属于父级会话调度状态，不写入共享计划或其他 Memory。子任务只在真实扩展支持的范围内运行，不假定持久 ID、消息或会话复用。
- 修改授权不自动包含提交、推送、合并、删除、历史重写、配置或 Memory 写入。只在验收逐项有当前证据时报告 `COMPLETE`，显式列明未执行/不可用检查、风险与未授权效果。

## MCP 支持边界

此扩展仅实现宿主侧流程与 Hooks，**本轮不修改 MCP Server**、安装器或调用身份协议。可选导航/咨询不适用时直接依据 owner；必需能力缺失只阻断依赖分支。不得伪造旧身份、grant、事务或服务器适配。

MCP Tools 内部仍用 OpenAI API；每次真实调用读取非空 `OPENAI_API_KEY` 与 `OPENAI_BASE_URL`，固定模型 `gpt-6-luna`，不输出凭据。默认 Mock，真实出站仍须授权；Pi 会话/子任务模型与此 API 模型独立。

[Hooks 触发目录](hooks/README.md) · [详细工作流架构](WORKFLOW_ARCHITECTURE.md) · [运行时能力边界](references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md)
