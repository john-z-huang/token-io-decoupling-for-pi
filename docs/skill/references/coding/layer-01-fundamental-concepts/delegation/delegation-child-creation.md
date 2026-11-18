# Coding 子 Agent 创建

<!-- 由 docs/rules/references/coding/layer-01-fundamental-concepts/delegation/delegation-child-creation.yaml 生成。请在 DSL 中维护正文。 -->


本文档负责 Multi-Agent 子代理创建的唯一能力入口。它消费已放行的模式/数量门禁、已预留且分配职责的名额、符合条件的输出类型，以及已放行的具体 Interaction Slice；不重新确认 mode/count，不分配职责，不决定 replacement 或生命周期政策。创建成功后只回写实际 Agent 身份和初始 lifecycle，且不得新增名额。

## 通用规范

### 创建能力

每次创建前，Root 先按[子代理端点跟随 Root](../session-runtime/runtime-provider-support.md#子代理端点跟随-root)确认自身当前 provider、模型及可见 API/端点路由元数据与来源，再核验子代理参数或继承路径使用同一端点；按任务选择模型/推理强度不得跨端点。元数据不明、冲突、同端点模型不可用或工具无法保证该路由时阻断创建，不沿用未经核验的默认值，不静默回退其他 provider。此项是必需条件，不是可选 thinking/effort 设置。

创建前按[运行时与能力边界](../session-runtime/runtime-provider-support.md)核对当前任务目标、职责、范围、依赖、风险、不确定性、验证要求和失败证据。由Root按运行时owner的三模型卡参考选择Sol/Terra/Luna与大致推理水平，不再全部固定Luna；职责不绑定模型，创建前简述任务依据。只有扩展实际支持且任务需要时才选择thinking/effort；没有可选设置控制时沿用默认值并记录限制，明确必需的设置无法落实时才阻塞。创建前立即复核当前 Slice 与实际返回的 Hash/fingerprint，不强求工具未返回的字段，不要求子代理自查模型设置。

Pi 不内置子代理；仅在已核验当前 subagent 扩展的实际 schema 和能力后调用。支持时可执行一次性任务、parallel 或 chain；不得假定持久 ID、消息、wait 或 resume。创建前须有已放行的 Multi-Agent 门禁、锁定正整数数量、已分配职责且未绑定的预留名额，以及 `slice_status: released` 的 Interaction Slice（目标、范围/修改、返回条件和 memo 开关）。只对实际需要跨 Slice 复用的分支要求持久能力；其缺失不阻塞一次性切片。一次性执行以真实任务调用证据和父级逻辑 allocation 定位；不伪造宿主 ID，允许正常创建、执行、返回，但结果不得再冒用该执行身份。只有扩展确实支持时才复用。输出限获准代码/配置或 Skill 指令/参考文档；普通文档由根父级编写。不得仅因 Multi-Agent 选择而创建。创建及返回遵守只读验证安全边界、数量及角色唯一性。状态由父级依据当前真实记录和用户批准在对话中维护，不写 Memory；MCP 不提供调度身份事务，不伪造受保护回执。`workflow_select_child_effort` 已删除，不调用。

## Pi Coding Agent 优化指令

Pi 不内置子代理。先核对实际扩展 Schema，再提交已放行的目标、目录、范围、来源和返回条件；仅传扩展真实接受的字段。同步一次性调用可以同时完成创建、派发和返回，不要求存在独立创建命令。将逻辑 allocation 与实际工具调用/任务结果证据绑定；若返回宿主身份则记录原值，否则不虚构持久 Session ID。可选 thinking 控制缺失时使用扩展默认值；workflow_select_child_effort 已删除，记录 Not applicable，不能伪造参数。


## 相关概念

- [Coding Child Lifecycle](delegation-child-lifecycle.md) — 定位子 Agent 状态归属。
- [Coding Child Role Allocation](delegation-child-role-allocation.md) — 定位名额和职责分配。
- [Coding Child Dispatch](delegation-child-dispatch.md) — 定位实际派发边界。
- [Coding Child Reuse and Replacement](delegation-child-reuse-replacement.md) — 定位获准的复用和替换。
- [Coding Session Model](../session-runtime/session-model.md) — 定位 role 和 Session 归属。
- [Coding Context Exchange](../context-exchange/context-exchange.md) — 定位必要的上下文传输归属。
- [Coding Session 审计可见性](../session-runtime/session-audit-visibility.md) — 定位会话审计配置。
