# 工作流导航可用性


本文档负责可选工作流导航或结构检查不可用时的处置；不负责策略、调用方身份、权限或检查点结果。

## 通用规范

工作流当前 owner 文档仍具权威性。导航工具及其注册表是可选辅助能力，用于定位有界的当前规则正文和检查所供输入结构。其可用性不能证明运行时身份、受保护操作能力、权限或工作流状态。

若导航不可用或不完整，且当前 Session 的授权能力可以访问相关权威 owner，则直接阅读该 owner。阅读范围限制在当前判断所需内容。若无法获取必需 owner，则仅阻塞依赖它的工作；不得推断其策略或跳过要求。可选导航不需要时，记录附有理由的 `Not applicable`。

无状态结构检查不能取代直接审阅 owner、解释证据、授权、Slice 释放、Control、验证或验收。它们不保留规范工作流状态，不建立跨调用顺序，也不能将调用方提供的 Hash 变为证明。

## Pi Coding Agent 优化指令

通过 Pi codemode 的 `searchTools`、`describeTool`、`describeNamespace` 核对实际 MCP 能力及 schema，调用检查 `isError`；hidden 不得绕过。项目 Server 未迁移时不得假称支持。Pi 可授权直接读取当前 owner 文档；可选导航或结构检查不适用时，依据当前 owner 判断并记录理由。必需能力缺失只阻塞依赖该能力的判断。旧身份上下文不可伪造。

## 相关概念

- [工作流规则上下文](rule-context.md) — 负责有界规则导航。
- [检查点结构检查](checkpoint-structure-checks.md) — 负责对所供事实执行可选结构检查。
- [Coding Execution Control](../execution-control/execution-control.md) — 负责 Slice 与 Control 的授权边界。
