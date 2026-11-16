# 工作流规则上下文


本文档负责有界导航至当前工作流规则；不负责检查点结构评估、底层规则、调用方身份或工作授权。

## 通用规范

### 仅读取所需规则上下文

使用当前工作流 owner 作为权威来源。注册表或有界摘录可帮助定位适用标题，但其存在、Hash 或完整状态不能证明已读取完整任务上下文，也不能证明检查点已通过。若判断依赖返回材料未包含的直接链接 owner，应以相同语言单独读取该 owner。绝不能根据索引、摘录、过期快照或 Hash 推断缺失的策略。

将导航范围限制在当前判断所需内容。不得扫描整个仓库，也不得将链接引用视为已递归加载。必需内容缺失或结果不完整时，调用方必须直接获取权威 owner；若无法获取，则仅阻塞依赖该内容的判断。导航不需要时，记录附有理由的 `Not applicable`。


## Pi Coding Agent 优化指令

通过 Pi codemode 的 `searchTools`、`describeTool`、`describeNamespace` 核对实际 MCP 能力及 schema，调用检查 `isError`；hidden 不得绕过。项目 Server 未迁移时不得假称支持。Pi 可授权直接读取当前 owner 文档；可选导航或结构检查不适用时，依据当前 owner 判断并记录理由。必需能力缺失只阻塞依赖该能力的判断。旧身份上下文不可伪造。

## 相关概念

- [工作流导航可用性](navigation-availability.md) — 负责导航不可用分支。
- [检查点结构检查](checkpoint-structure-checks.md) — 负责评估调用方提供的检查点事实结构。
- [Workflow Routing Advice](../execution-planning/workflow-routing-advice.md) — 负责可选阶段建议。
- [Coding Execution Control](../execution-control/execution-control.md) — 负责 Slice 与 Control 决策。
- [Coding Delegation State Record](../delegation/delegation-state-record.md) — 负责规范的父级控制工作流记录。
