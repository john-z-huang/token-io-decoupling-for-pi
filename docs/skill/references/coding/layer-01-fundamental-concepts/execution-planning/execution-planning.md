# Coding Execution Planning

<!-- 由 docs/rules/references/coding/layer-01-fundamental-concepts/execution-planning/execution-planning.yaml 生成。请在 DSL 中维护正文。 -->


本文档负责两级执行规划：将已批准方向转换为有界计划和阶段提纲，并安排 reconnaissance 在实现放行之前发生。不定义决策门禁策略、Interaction Slice 字段、阶段反馈、角色/Session 语义、上下文传输或委派生命周期。

## 通用规范

### 两级规划

将已批准方向转换为有界的检查、实现和定向检查步骤。计划记录阶段提纲以及每个阶段预期产出的证据，但不把阶段写成命令列表。

### 从 reconnaissance 到实现放行

在实质性决策前需要项目事实时，规划一个有界 reconnaissance slice，返回压缩事实、有证据支持的选项和未解决问题。随后由决策门禁确认或否定方向，再放行实现。规划不批准新的语义或架构方向。共享任务计划默认按[任务计划 Memory 生命周期](task-plan-memory-lifecycle.md)持久化，无需额外规划请求。专用规划模式只是可选起草路径。计划与父级实时调度状态分离。

## Pi Coding Agent 优化指令

Pi 不内置 Plan mode。直接在当前获授权上下文起草有界阶段计划，按任务计划 owner 使用实际 Memory 后端；仅在真实扩展存在且获授权时使用规划辅助，不为规划启动额外 Session。计划不是写入或执行授权。


## 相关概念

- [任务计划 Memory 生命周期](task-plan-memory-lifecycle.md) — 定位计划文档持久化与归档生命周期。
- [Coding Execution Control](../execution-control/execution-control.md) — 定位 Interaction Slice 放行和边界控制。
- [Coding Execution Decision Gate](execution-decision-gate.md) — 定位 Decision Brief 和实现放行决策。
- [Coding Execution Stage Feedback](../execution-control/execution-stage-feedback.md) — 定位有界阶段反馈。
- [Coding Session Model](../session-runtime/session-model.md) — 定位角色和 Session 归属。
- [Coding Context Exchange](../context-exchange/context-exchange.md) — 定位上下文传输归属。
- [Coding 子 Agent 生命周期](../delegation/delegation-child-lifecycle.md) — 定位委派生命周期归属。
