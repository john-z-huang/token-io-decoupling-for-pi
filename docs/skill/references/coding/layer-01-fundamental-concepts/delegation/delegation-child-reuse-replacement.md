# Coding 子 Agent 复用与替换


本文档负责已创建子 Agent 的获准 follow-up、修复 epoch 以及复用或替换关系。不定义子 Agent 创建、职责分配、Dispatch Preview、Worker 边界、生命周期状态或上下文传输。

## 通用规范

### 获准复用

模型和 reasoning-effort 设置仅在创建子代理时核验。对同一子代理的 follow-up、修复、compaction、中断、唤醒或恢复不得重复核验，也不得要求子代理检查/报告这些设置。本模块中的子代理身份、生命周期、授权、范围和返回路径规则仍须执行。

对已授权 follow-up、修复 epoch 和中断，在安全时复用同一个已创建子代理。优先通过该子代理尝试获准修复；无法安全继续时报告阻塞，并将依赖的 Multi-Agent 工作置为 `blocked`。复用不得创建递归层级或 peer 协调。已创建子代理的身份和证据遵循生命周期 owner 保留。

### 替换关系

创建该名额的子代理前，父级授权的计划修订可在当前批准数量内调整 `agent: unbound` allocation 的职责或待放行 Slice。数量尚未锁定时，awaiting-count 记录不存在可修订的 allocation。在现有数量内，可通过正常放行和创建门禁，使用未分配名额及尚未占用的职责创建额外子代理。子代理一旦创建，其身份、名额和职责在本 Session 中永久绑定，不得回收或替换。超过当前数量的任何子代理，都必须取得[委派数量门禁](delegation-mode-count-gate.md)要求的实际用户批准，精确增加一个名额并使用不同且未占用的职责；该批准绝不允许替换或重复职责。不得重新打开数量问题、fork 或 handoff 到新子代理以绕过这些门禁。上下文交接由[上下文交换交接](../context-exchange/context-exchange-handoff.md)负责，不授予创建 Agent 的能力。

## Pi Coding Agent 优化指令

一次性任务完成后不能继续向其虚构身份派发。仅当扩展提供真实稳定身份与续接能力时复用；否则在本 owner 的名额与职责边界内报告复用不可用，交父级决定后续合法路线，不静默再建同职责 successor。


## 相关概念

- [Coding Child Creation](delegation-child-creation.md) — 定位子 Agent 创建能力。
- [Coding Child Role Allocation](delegation-child-role-allocation.md) — 定位名额和职责分配。
- [Coding Child Dispatch](delegation-child-dispatch.md) — 定位实际派发边界。
- [Coding Child Lifecycle](delegation-child-lifecycle.md) — 定位子 Agent 状态和恢复归属。
- [Coding Context Exchange](../context-exchange/context-exchange.md) — 定位 handoff 和上下文传输归属。
