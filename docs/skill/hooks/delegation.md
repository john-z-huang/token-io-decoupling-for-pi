# 有界委派与一次性任务

## 触发条件

本合同在 Coding 任务拟采用 Multi-Agent、评估/预留新执行者、准备创建或派发子代理，或工作流要求独立验证时适用；具体路线包括委派模块 DE00–DE09、实际创建/派发前置检查及 VR02 的独立验证需求。它是对委派参考 owner 的本地执行适配，不是宿主回调、MCP 工具或代理调度器。

仅选择 Multi-Agent、锁定预算、显示模式菜单、完成 Bootstrap，均不代表创建授权。Single-Agent 下不得创建子代理；即使用户要求子代理，也须先解决模式冲突。只有实际获授权任务确需新执行者且所有前置门禁满足时才进入创建。独立验证要求若无真正独立且合格的当前 Session 身份，必须报告不可用，不能以改名或同一上下文自称独立。

## 执行要求

### 1. Root 前置、模式与预算

Root/根父级先核对用户指令、权限、安全和仓库边界，完成指令分析、环境确认、定义任务所需的代码事实、Semantic Contract、架构/风险决策、验收条件及未决权衡；将有来源的精确事实和范围写入指令。不得把这些前置判断委派给 Worker，也不得让 Worker 改变目标、约束、架构或验收标准。分派前须有实际授权的拟派任务、当前 Context/Decision 和可追溯 source pointer。

首次 Coding 指令按模式确认 owner 选择路线；模式在同一宿主 Session 生命周期固定。Multi-Agent 数量为用户明确给出的有效正整数，否则按规则缺省为 1；用户选择自定义数量却遗漏/给出无效值时只询问聚焦问题并保持未放行，不得擅自改成 1。数量是整个 Session 的子代理总预算，不是每轮/阶段预算。每次路线放行前回读父级规范状态记录：owner、模式及来源、锁定数量、allocation、职责、Slice、生命周期和阻断原因。初始恰好预留该数量的 allocation，均为 unbound/unassigned/pending；预留不选择职责、不放行 Slice、不创建代理。

同一 Session 后续轮次、compact 或恢复不重选模式/预算。唯一扩额是用户实际明确批准恰好当前数量加一，且用于不同、未占用职责；记录准确批准来源、新旧值并保留先前来源。这只是父级记录协调，不是服务端原子事务。建议、推断、API 结果、针对其他事情的旧批准都不算授权。无未占用职责时不得申请扩额；数量/拓扑其他变更阻断依赖工作，直到新 Session。Fork 是新 Session，须重新通过模式/数量门禁，不得导入来源 Session 的代理身份或选择。

### 2. 执行者、职责与准入次序

先根据授权任务、当前身份、能力、权限、可用性和锁定模式选择 Root 或合格的当前 Session 子代理。Single-Agent 明确由 Root 执行；Multi-Agent 也不预设必须委派。若没有合格候选且事实确实要求新执行者，可得出 new-executor-needed；该结论本身不预留、不授权创建。Output Route 必须独立处置 Root 直接输出后，才能进入新角色预留。

四种受维护职责为 Primary Output、Change Verification、Context Bootstrap/Refresh、Documentation/Comments & Git Operations。将实际拟派任务匹配唯一职责，完整审阅当前 Session 台账；其他 Session 的继承代理不计入。用户明确职责可跳过建议，但 Root 仍须核验。建议/上下文生成失败不能自动默认某职责；有充分核实事实时 Root 可独立判断，否则阻断。用户明确要求创建但未指定职责，仅在其他创建门禁已确认且 Primary 未占用时，Primary 才可作有条件回退。

Primary 只做已放行的代码/配置实现或本 Skill 指令/参考文档编辑；普通非 Skill 文档和评论由 Root，即使伴随代码修改。Change Verification必须由未参与实现的独立身份承担，除明确点名的验证资产可按授权修改外，对产品代码/配置、文档和Git只读；不修复、不暂存或提交。Context Bootstrap/Refresh 只返回中性事实、准确来源及缺失上下文，不定义任务、不实现/验证、不递归委派；仅当复用收益合理时分配（例如多个下游 Worker、广泛侦察或大来源集合），小任务不强求。Documentation/Comments & Git Operations 仅承担明确放行且权限允许的非简单 Git slice；普通文档仍由 Root，该职责不自带 Git 授权。

已占用职责不得重复。若角色不同且未占用但容量不足，才可请求明确 +1；全部职责占用则阻断且不申请扩额。只有尚未创建的 unbound allocation 可由父级授权在当前预算内调整计划；已创建身份、名额、职责永久绑定，不因成功、失败、中断、取消或不可用回收。职责预留必须先于 Slice 放行；Slice 必须明确目标、范围/修改、返回条件及必要证据，授权后一次派发一个，除非已明确放行独立且不冲突的并行任务。

派发 bundle 必须携带启动时确认的审计三字段和每字段 `explicit/default` 来源。它们仅控制安全消息/摘要策略，不证明完整 Worker 日志可访问，不允许私有思维链披露，不改变授权、职责预算或独立验证。

### 3. 创建、派发与能力适配

Pi 不内置代理。当前实现仅支持实际可用、Schema 明确为 `agent`/`task`/`cwd` 的一次性任务调用；先核验真实工具/扩展 Schema、可用能力和允许字段，只传真实接受的字段。扩展配置名称不是职责或权限证明。不存在兼容能力时只阻断依赖委派的分支；不得假设隐藏工具、Pi 原生代理、持久 Session、稳定 ID、续接、消息、wait、resume、取消或异步句柄，也不得模拟 Session 或将 Root 改名为子代理。没有可选模型/effort 控制时沿用扩展默认值并记录限制；明确必需设置无法满足才阻断。尚未迁移的 MCP 身份/effort 契约不调用、不伪造回执。

创建前再次核实 Multi-Agent 已释放、正数预算、唯一未绑定 allocation 与职责、合格输出类型、已释放 Slice、权限、上下文、来源/路径及返回条件。Worker bundle 必须清晰限定单一职责，禁止递归创建/派发、fork、自行选择handoff目标、peer协调或联系其他Session；按父级具名授权编写handoff记录不等于自行管理会话；禁止未授权网络、Git、Memory 或扩容。按实际需要提供任务计划/Memory 的准确名称和最小访问方式；Root 协调唯一计划写者，贡献不授权修改源码或扩大 Contract。显式提供 `write_content_memo: true|false`：true 才按对应生命周期处理 memo，false 不得推断或写入；它不豁免共享计划规则。

DE05只作真实能力与创建前置核验；DE06通过同一次实际工具调用创建/派发/执行/返回，DE07审阅完整实际结果后才接续。一次性工具调用可同步完成创建、派发、执行和返回；父级以同次真实调用证据将 allocation 绑定逻辑身份/任务证据。无返回持久身份时不伪造 Session ID。当前没有 Git 专用子代理、持久任务复用适配器，也未迁移 MCP 身份/effort；需要这些能力的分支阻断，不得把通用 Worker 设为 Git 专用角色或声称符合专用能力。合同不是隔离沙箱，不能保证外部进程或其他扩展行为受 Hooks 覆盖；若隔离为必要条件而实际能力缺失，阻断。

只在已分别放行、互不冲突的任务间并行；Chain 中每一步仍须各自满足授权、职责和范围，不能作为同一 Session 复用证据。已创建代理不能因不满意而替换；对获准修复优先复用同一稳定身份，仅当真实扩展支持续接才可 follow-up。一次性返回后身份不可继续派发。无法安全续接时报告阻塞并由 Root 判断合法路线，不静默创建同职责 successor；增加名额也不允许替换或重复职责。

### 4. Root选择模型与推理强度

不再把所有子代理固定为Luna；职责和模型独立。Root依据输入类型、任务复杂度/依赖、不确定性、风险、验证充分性、输入量与延迟/成本，在实际可用的三个模型中选择，并给出简短依据：
- Sol：模型卡面向复杂编码/专业工作，复杂实现、修复、独立反例检查可优先考虑medium/high。
- Terra：模型卡面向视觉推理与清晰写作，获准静态图像/图纸证据或Skill文档可考虑low/medium；不是Computer Use授权。
- Luna：模型卡面向聚焦高吞吐，有界事实提取、机械改动、规则明确的实现/检查可考虑low/medium。
这些仅是参考起点，任何职责均不强制某一模型；普通文档仍由Root。一般多步任务medium，简单确定任务low，复杂/高风险任务可high；xhigh/max须有具体必要性，不是固定升级阶梯。卡片支持Sol的low/medium/high/xhigh/max，Terra/Luna另有none；Pi使用off而非none，三者不选minimal，且须核对真实provider映射。更大推理量不弥补缺失授权/证据，独立性也不由不同模型证明。

先核对真实Schema。在增强版subagent中用精确 `model: "provider/id:thinking"`；coding_delegate每项job传 `model` 与 `modelReason`，仅目标工具确有model字段才转交，不能默默忽略。未提供控制的旧工具仅能记录实际默认/继承值和限制，不假装task文字已选模型；任务必需选择无法落实则阻断。不要改父级模型、全局默认或MCP内部API模型来代替子任务设置。创建前核验即可，不要求Worker自查/自报；已创建身份不因换模型而重建、替换或回收。详见[模型卡事实、档位与路由参考](../references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md#子代理模型与推理强度参考)。

### 5. 结果、生命周期与未知效果

派发后取得真实返回内容。工具状态、调用卡片、送达回执、摘要、Hash 或“完成”字样不替代正文。依赖结果前完整读取所有实际结果；过长则逐页/分段读取至末尾，不以摘要验收。确认并审阅完整结果中的改动路径、执行/检查证据、失败、遗漏、未决项及与授权范围的偏差；对实际仓库状态做必要核对。结果与已确认前提冲突、超出范围或不完整时停止依赖工作，返回 Root 重决策，不自行扩大授权。子代理结果不是应用改动或继续操作的授权。最终验证仍属后续独立工作流，不把初步检查冒充验证。

父级记录真实调用、身份/逻辑 allocation、状态、完整结果证据及阻塞原因。仅实际完整结果和证据允许标记 completed；失败/中断保留原身份与状态，终态绝不释放已绑定预算或职责，也不得仅为清理关闭/删除代理。当前工具为同步一次性调用，不轮询、不等待、不恢复、不取消，也不重派。对调用错误、超时、断连等无法确认是否执行的情况，视为效果未知：先读取可用的真实结果/当前状态证据，保留 allocation 并报告；无从核验则阻断，绝不重发以免重复副作用。只有宿主明确证明执行未发生且 allocation 仍未绑定时，才可依据 owner 撤销预留；不能从错误文本推断“未创建”。

## 退出与阻断

仅在前置授权、当前 Session 状态、职责唯一性、预算、能力、权限和 Slice 全部成立后才调用工具；仅在实际结果完整读完、与授权相符且当前状态可审阅后，接受为实施结果。失败、证据不足、角色/模式冲突、身份不明、无兼容工具、未授权效果、结果未知或隔离能力缺失均阻断受影响的依赖工作。阻断时保留事实与状态并向 Root/用户报告具体缺口，不换工具绕过、不伪造成功、不静默缩小/扩大任务。无需委派的 Root 路线正常继续，不因缺少代理能力而无条件阻断。

## 重新核验

任务目标/授权、模式或批准数量、allocation/职责、Session 身份、工具 Schema/能力、cwd/路径、权限、并行冲突、Slice、返回证据或效果状态发生变化时，仅重核受影响门禁；派发前立即复核身份、职责、权限、能力、范围和当前可用性。依赖任何 Worker 结果前确保全文读取；发生未知效果时先核验而非重派。父级持续维护唯一规范记录和批准来源，过时摘要不得覆盖当前事实。

## 规则来源

| 来源 | 本合同落点 |
| --- | --- |
| [delegation-child-reuse-replacement.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-child-reuse-replacement.md) | 已创建代理复用、替换禁止、一次性身份限制 |
| [delegation-state-record.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-state-record.md) | 父级记录、预算/allocation、职责与 Slice 状态、来源及生命周期 |
| [child-role-selection.md](../references/coding/layer-01-fundamental-concepts/delegation/child-role-selection.md) | 职责选择、证据不足、Primary 条件回退 |
| [delegation-mode-reentry.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-mode-reentry.md) | Session 固定门禁、Fork 重新进入与阻断 |
| [delegation-child-message-visibility.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-child-message-visibility.md) | 完整正文可见、依赖前读完实际结果 |
| [delegation-child-role-allocation.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-child-role-allocation.md) | 名额预留、职责唯一和辅助角色分配条件 |
| [delegation-mode-count-gate.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-mode-count-gate.md) | 数量缺省/无效分支、+1 实际用户批准 |
| [delegation-child-lifecycle.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-child-lifecycle.md) | 生命周期证据、错误中断及终态不回收 |
| [delegation-child-dispatch.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-child-dispatch.md) | Slice、Dispatch Preview/Worker 边界和单一父级返回 |
| [delegation-mode-confirmation.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-mode-confirmation.md) | 初始模式菜单、默认值及 Single-Agent 限制 |
| [delegation-child-creation.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-child-creation.md) | Pi 能力核对、创建前置和一次性调用适配 |
| [delegation-worker-boundary.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-worker-boundary.md) | Worker 读取、贡献、边界及 Root 记录权威 |
| [runtime-provider-support.md](../references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md) | Root按模型卡自主选择三模型/推理档位、真实参数能力与API边界 |
| [session-role-ownership.md](../references/coding/layer-01-fundamental-concepts/session-runtime/session-role-ownership.md) | Root 前置职责、四类角色与职责界限 |
| [executor-selection.md](../references/coding/layer-03-workflow-checkpoints/executor-selection.md) | 先选 Root/当前执行者，再判断是否需要新执行者 |
| [role-reservation.md](../references/coding/layer-03-workflow-checkpoints/role-reservation.md) | new-executor-needed 后预留角色；不在本步创建/放行 Slice |
| [delegated-execution.md](../references/coding/layer-04-workflows/modules/delegated-execution.md) | DE00–DE09 顺序、共用 Slice 门禁、结果和 continuation |
