# Coding Session Context Firewall


本文档负责 Context Firewall：原始状态进入限制、有界检查、事实返回边界和临时项目定位。不定义职责责任、Session 语义、Memory 上下文传输或工作流验收。

## 通用规范

### 原始状态进入

在多 Session Coding 中，输入侧 Session 按[职责归属](session-role-ownership.md)要求读取派发前确认所需的有界、只读环境与代码证据，不进行开放式项目扫描。Primary Output 仅在父级确认和放行的范围内读取更多源代码/配置状态；Change Verification 消费最终状态证据；Documentation/Comments & Git Operations 消费 Git 状态和获准文档范围。各自只返回下一步决策需要的事实与准确来源。

原始状态摄入边界由潜在输出体积、状态敏感性和仓库影响决定，而不是命令名称。单 Session 没有跨 Session Firewall，但仍须渐进读取并压缩原始状态。

### 语义 ownership 和临时定位

Firewall 只限制原始状态进入，不转移语义责任；语义权威性遵循[职责归属](session-role-ownership.md)。临时项目定位事实不自动提升为长期 Contract 状态，也不应倾倒原始状态。经授权且可复用的上下文记录可按 [Coding Context Exchange](../context-exchange/context-exchange.md) 和 [Coding Context Exchange Workspace Boundary](../context-exchange/context-exchange-workspace-boundary.md) 使用具名项目 Memory 持久化；Memory 名称只表达逻辑归属，不提供技术隔离。

## Pi Coding Agent 优化指令

子代理隔离取决于实际扩展，不能从一次独立任务或工作目录推断文件系统隔离。codemode 自身没有直接文件系统或网络访问，须调用已授权工具；只将当前判断需要的有界证据 text 返回父级。


## 相关概念

- [Coding Session Model](session-model.md) — 定位 Session 语义和 Affinity。
- [Coding Session Role Ownership](session-role-ownership.md) — 定位职责责任归属。
- [Coding Context Exchange](../context-exchange/context-exchange.md) — 定位 Memory 上下文传输。
- [Coding Delegation State Record](../delegation/delegation-state-record.md) — 定位任务控制状态归属。
- [Coding Execution Control](../execution-control/execution-control.md) — 定位有界阶段和 slice 归属。
