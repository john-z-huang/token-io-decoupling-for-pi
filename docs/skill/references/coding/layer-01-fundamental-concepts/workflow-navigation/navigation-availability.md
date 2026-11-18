# 工作流导航可用性


本文档负责可选工作流导航或结构检查不可用时的处置；不负责策略、调用方身份、权限或检查点结果。

## 通用规范

工作流当前 owner 文档仍具权威性。导航工具及其注册表是可选辅助能力，用于定位有界的当前规则正文和检查所供输入结构。其可用性不能证明运行时身份、受保护操作能力、权限或工作流状态。

若导航不可用或不完整，且当前 Session 的授权能力可以访问相关权威 owner，则直接阅读该 owner。阅读范围限制在当前判断所需内容。若无法获取必需 owner，则仅阻塞依赖它的工作；不得推断其策略或跳过要求。可选导航不需要时，记录附有理由的 `Not applicable`。

无状态结构检查不能取代直接审阅 owner、解释证据、授权、Slice 释放、Control、验证或验收。它们不保留规范工作流状态，不建立跨调用顺序，也不能将调用方提供的 Hash 变为证明。

## Pi Coding Agent 优化指令

可按当前工具发现能力核验实际 Schema；暴露 codemode 时可用 `searchTools`、`describeTool` 和 `describeNamespace`。`token-io-decoupling-tools` 提供规则上下文与候选文档预检。专用工作流路由和检查点结构评估已移除。缺少可选辅助时直接读取 owner；只有缺少必需证据才暂停依赖工作。

## 相关概念

- [工作流规则上下文](rule-context.md) — 负责有界规则导航。
- [检查点结构检查](checkpoint-structure-checks.md) — 负责对所供事实执行可选结构检查。
- [Coding Execution Control](../execution-control/execution-control.md) — 负责 Slice 与 Control 的授权边界。
