# 检查点结构检查


本文档负责对调用方提供的检查点事实和证据执行确定性结构评估。不负责认证输入、判定语义真实性、授权工作或验收任务。

## 通用规范

### 将评估视为可选的结构辅助

当结构检查有助于识别当前检查点判断中缺失或格式错误的所供事实时，可使用该检查。当前检查点 owner 仍是权威来源。应直接检查该 owner 并判断证据含义；结构完整的提交不证明事实真实，也不表示检查点已通过。

调用方提供的输入、证据引用、修订、指纹和 Hash 始终是调用方提供的事实。检查器可以拒绝格式错误、不一致、过期或不受支持的输入，但不能认证调用方、证明权限或来源、授予授权、建立跨调用顺序或验收任务。结果不持久化状态，也不会记住先前调用。

若实际使用的检查器定义 `ready_for_agent_review`，它仅表示所供输入满足该检查器的结构要求。`incomplete_for_agent_review` 报告缺失的必需事实或证据。`blocked_input` 报告无效、不一致、过期或不受支持的输入。无论何种状态，均须独立审阅当前 owner 和证据。

对于 Control，结构结果不能取代当前 Control owner、当前状态验证或必需的用户/Agent 判断。若可选结构检查不可用，应直接使用权威 owner 和可用证据；仅当无法以其他方式确立判断所需输入时，才阻塞该判断。

## Pi Coding Agent 优化指令

本项目 MCP 已移除检查点评估入口。协调扩展的 `coding_checkpoint report` 校验声明字段、顺序和已观察引用，并可能更新当前扩展状态。候选合规预检只检查候选文件结构。要判断检查点事实与证据，直接按其 owner 审阅。

## 相关概念

- [工作流规则上下文](rule-context.md) — 负责有界导航至当前工作流规则。
- [工作流导航可用性](navigation-availability.md) — 负责导航不可用和可选检查分支。
- [Coding Execution Control](../execution-control/execution-control.md) — 负责 Slice 与 Control 判断。
- [Decisions Advisory](../execution-planning/decisions-advisory.md) — 负责单独请求的可选语义建议。
