# Session Hook 合同

## 触发条件

当首次收到 Coding 指令、进入任何依赖当前 Session 身份/模式/数量/分配的工作、恢复或 compact 后继续、出现真正新根/Fork、需更新父级控制记录，或准备使用 Worker/子代理时触发。它覆盖完整宿主 Session 生命周期，不是逐轮重选。普通后续轮次沿用已锁定状态；真正新身份的 Fork 必须重新经过模式与数量门禁。Pi 的主会话、扩展子任务、持久子代理身份不是天然一一对应；不得从工作目录、名称或一次调用推断身份或 worktree 隔离。

输入至少包括用户当前指令及明确模式/数量偏好、当前 Session 身份证据、现存规范父级对话记录、已释放路线和任务 Contract。记录尚不存在不构成入口失败，应按首次选择建档；但依赖状态的受保护操作不能在模式/身份/记录证据缺失或冲突时继续。

## 执行要求

### 1. 选择并锁定模式

根父级在首次 Coding 指令到达时处理模式。用户已给出有效模式和数量就直接采用，不重复询问。否则呈现编号菜单：1) Multi-Agent Coding，1 个子代理（推荐/缺省）；2) Single-Agent Coding，0 个子代理；3) Multi-Agent Coding，自定义正整数；4) 自定义完整指令，映射到受维护路线及有效数量。选项 3 未给出有效正整数时只问一个聚焦问题并保持门禁未放行，绝不能猜成 1。选项 4 缺失、含糊、冲突、要求未维护路线或能力时只请求聚焦澄清；不得把自定义文字解释成授权或创造能力。用户明确无偏好时采用缺省；仅在必须放行且仍没有有效用户选择时才采用缺省，未回复提问本身不强迫放行。Pi 用普通文本呈现，不依赖专属问卷工具。

显式选择记 `mode_source: explicit`；缺省记 `default`。缺省路线为 Multi-Agent、数量 1。单代理记数量 0。模式固定于宿主 Session 生命周期；同会话后续指令、compact、恢复不重开门禁。唯一同会话数量例外是用户实际明确批准为不同且未占用的职责增加恰好一个名额，按数量门禁保留旧值和批准来源；不改模式、不放行 Slice、不创建子代理。能力缺失不能默默换模式/数量。

### 2. 维护规范状态

根父级在获授权对话上下文维护唯一规范记录，路线放行前回读；不写数据库、policy 文件或 Memory，不以短暂子代理状态、工具结果、hash、旧摘要重建历史。记录至少完整呈现：

```text
owner; run_id; gate_status; mode_source; mode; child_count; source;
semantic_references; allocations[{allocation_id, agent, role, slice_status,
interaction_slice, scope, mutations, return_conditions, lifecycle,
write_content_memo}]; session_audit{audit_mode, root_reasoning_cadence,
worker_reasoning_cadence, source各字段, worker_log_visibility,
worker_log_evidence}; lifecycle; unavailable_capabilities; block_reason
```

字段合法状态及结构须与状态记录 owner 一致：gate 为 awaiting-mode / awaiting-count / released / blocked；初始 awaiting-mode 为未设模式/数量、空 allocations、顶层 pending；仅用户明确给出无效数量时可 awaiting-count；released 的 Single-Agent 为数量 0、空 allocations；released Multi-Agent 有稳定 run_id、正整数锁定数量、恰好同数 allocation，初始均 unbound/unassigned/pending；blocked 保留已确认值、现有生命周期，且写明能力及原因。初始 default 组合必须为 Multi-Agent/1/一个预留名额。旧 timeout-default 仅按兼容规则读回，不新建；旧值必须维持 Single-Agent/0/空名额。分配状态不得覆盖有效记录。

锁定数量只预留容量，不选择职责、不授权、不初始化 Agent、不释放 Context/Decision/Slice。每个 allocation 有稳定唯一 ID；未绑定名额为 `agent: unbound`、`role: unassigned`、`slice_status: pending`、`lifecycle: pending`。不得从名额数猜职责；单个名额不是自动的 Primary Output。审阅当前任务上下文及 Decision 后，才可选择唯一未占用职责并记入一个名额。子代理四种职责分别为 Primary Output、Change Verification、Context Bootstrap/Refresh、Documentation/Comments & Git Operations；Input-side Reasoning归Root，不占子代理职责名额。当前 Session 中职责唯一，子代理身份唯一。已完成、失败、中断、取消或不可用均不释放职责、身份或名额；不得回收、替换、Fork 继承或重复分配。四职责的责任边界按 owner：Root 保留指令/环境/代码事实确认、Semantic Contract、架构/风险决策、放行、用户交互及最终语义验收；Primary 仅执行已放行实现/Skill 指令编辑，不做前置决策或最终验收；Bootstrap 仅构建有界事实 capsule；Verifier 独立只读验证且不得参与被审实现；文档/Git 角色只做已放行非简单 Git，普通文档仍由 Root 写。角色标签、名额和 agent 名称均不改变这些边界。

已放行 allocation 的 Slice 必须有 role、interaction_slice、scope、mutations、return_conditions 和显式布尔 `write_content_memo`；每个序列化 Worker bundle 前明确 true/false，Worker 不猜默认值。创建任何子任务都须角色/Slice、真实扩展及权限成立；只有创建Primary Output还要求输出确为代码/配置实现或本Skill指令/参考文档编写编辑，不能把此资格误施于独立验证或Context职责。普通非 Skill 文档不触发/消耗 Primary 名额。复用不增名额；一次性调用不代表持久身份。

### 3. Pi 能力边界

以当前会话明确宿主元数据和实际暴露能力为准，不从模型名、工具名或 Shell 推断。工具可用不等于授权；模式获批不等于扩展存在。若当前有 codemode，先 `searchTools`/`describeTool` 核对实际工具 Schema，再按需读取 namespace 服务指令；hidden 不绕过。只有真实暴露且授权的子代理能力才可使用，按 Schema 核验范围、目录、权限、返回/取消、持久身份续接支持；仅传真实接受字段。不伪造 ID、调用结果、effort、消息或能力。Pi 不默认提供内置子代理或 Plan mode，不从 Shell 启动另一个 Pi 来补造。一次性任务以真实调用证据绑定逻辑 allocation，不声称可恢复；缺持久身份仅限制依赖复用的分支。Session 隔离不等于 worktree 隔离。禁止 Computer Use 及经 Shell/MCP/子代理包装的同类操作。

输入输出：输入是当前身份、用户选择、规范记录和扩展能力证据；输出是已读回的规范记录、锁定路线/容量、逐项证据与未满足前置。Session readiness 可返回 complete、needs_prerequisite、blocked；审计及容量核验不授权子代理工作。

## 退出与阻断

模式和数量有效、状态完整一致、当前身份/角色及必需权限可核实后，才能退出为可供后续 owner 消费的就绪状态。awaiting-mode/count、未解决选择、记录缺失/冲突、身份/角色证据不明、Schema 不支持必需字段、能力/权限拒绝或状态不安全时，阻断依赖该事实的操作并记录暂停点及原因。能力不可用只阻断依赖分支；有独立授权且不依赖该事实的工作可继续。单代理路线禁止创建、fork、handoff、联系、替换或管理其他 Agent/Session；独立验证仍是语义要求，但该路线不能提供独立性。不得把工具存在、菜单选择、容量记录或审计完成声称为创建授权。

## 重新核验

在每次路线放行/受保护操作前回读规范状态；分配、Slice、生命周期、用户批准、身份、权限、扩展工具清单/Schema、Contract 或相关事实变化后，只重新核验受影响项。compact/同会话恢复保留状态；身份为新根的 Fork 从本会话当前指令重新选择模式/数量、建新记录，不导入来源身份、预算或选择。核验结果绑定当前 Session 身份、角色、记录回读、分配及相关 epoch；消费前再读父级记录。恢复不清楚时先查证，不能从文件名猜测。

## 规则来源

| 来源 | 本合同落点 |
| --- | --- |
| [Session模型](../references/coding/layer-01-fundamental-concepts/session-runtime/session-model.md) | 生命周期、Fork、拓扑、Primary affinity与一次性任务 |
| [Session职责](../references/coding/layer-01-fundamental-concepts/session-runtime/session-role-ownership.md) | Root责任及四种子职责边界 |
| [委派状态记录](../references/coding/layer-01-fundamental-concepts/delegation/delegation-state-record.md) | 规范字段、状态、名额与唯一性 |
| [模式确认](../references/coding/layer-01-fundamental-concepts/delegation/delegation-mode-confirmation.md) | 四项菜单、默认值、显式来源 |
| [数量门禁](../references/coding/layer-01-fundamental-concepts/delegation/delegation-mode-count-gate.md) | 正整数、无效数量、不同职责的明确加一批准 |
| [模式重入](../references/coding/layer-01-fundamental-concepts/delegation/delegation-mode-reentry.md) | Session锁定、Fork新身份与重入 |
| [Pi运行时](../references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md) | Schema、能力/授权分离及适配缺口 |
| [状态解析](../references/coding/layer-03-workflow-checkpoints/session-state-resolution.md) | 当前父级记录、身份与读回 |
| [Session就绪模块](../references/coding/layer-04-workflows/modules/session-readiness.md) | 入口、审计/容量核验顺序及当前性 |
