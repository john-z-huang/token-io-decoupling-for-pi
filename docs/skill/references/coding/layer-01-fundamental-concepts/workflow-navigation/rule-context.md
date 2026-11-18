# 工作流规则上下文


本文档负责有界导航至当前工作流规则；不负责检查点结构评估、底层规则、调用方身份或工作授权。

## 通用规范

### 仅读取所需规则上下文

使用当前工作流 owner 作为权威来源。注册表或有界摘录可帮助定位适用标题，但其存在、Hash 或完整状态不能证明已读取完整任务上下文，也不能证明检查点已通过。若判断依赖返回材料未包含的直接链接 owner，应以相同语言单独读取该 owner。绝不能根据索引、摘录、过期快照或 Hash 推断缺失的策略。

将导航范围限制在当前判断所需内容。不得扫描整个仓库，也不得将链接引用视为已递归加载。必需内容缺失或结果不完整时，调用方必须直接获取权威 owner；若无法获取，则仅阻塞依赖该内容的判断。导航不需要时，记录附有理由的 `Not applicable`。


## Pi Coding Agent 优化指令

本项目 MCP 的 `rules_get_context` 提供已登记节点的只读 owner 摘录。`context_version=1` 可请求有界片段及已声明依赖；当 `complete=false`、存在 `missing_fragments` 或返回 `remaining_owner_refs` 时，按当前判断补读所需 owner。使用实际 Schema 和返回来源核验；旧会话身份无需填入规则读取参数。

## 相关概念

- [工作流导航可用性](navigation-availability.md) — 负责导航不可用分支。
- [检查点结构检查](checkpoint-structure-checks.md) — 负责评估调用方提供的检查点事实结构。
- [Workflow Routing Advice](../execution-planning/workflow-routing-advice.md) — 负责可选阶段建议。
- [Coding Execution Control](../execution-control/execution-control.md) — 负责 Slice 与 Control 决策。
- [Coding Delegation State Record](../delegation/delegation-state-record.md) — 负责规范的父级控制工作流记录。
