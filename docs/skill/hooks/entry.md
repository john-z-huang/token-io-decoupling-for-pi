# 入口就绪、Contract 与能力清单

## 触发条件

- 进入 `entry`（ER00–ER03），或 `requirements_changed / capability_changed` 要求重核入口事实。
- 顶层路线与直接模块调用都必须有当前任务和授权证据；本 Hook 核验已释放的模式与路线，不重新选择它们，不创建/派发代理。

## 输入与证据

直接用户要求/Issue及讨论、当前 Contract、系统/开发者元数据、仓库/worktree 根、能力清单、已锁定 mode/count 和路线入口证据、已知效果及当前 revision/epoch。未知字段明确记为未知，不填推测值。

## 执行要求

### 一、解析入口与恢复位置（ER00）

1. 按模块声明核对目的/范围、适用模式、必需授权与 Session 事实、前置证据及新鲜度、允许效果和返回条件。入口 `ready` 只准本模块核验，不授权实施或委派。
2. 缺前置时按语义 owner 返回补证，保留模块/子步骤 continuation；冲突或不安全状态标阻断。直接调用者可自行建立记录，不强求已有顶层路线。
3. 原先已完成的模式询问、写入、创建或 Git 不重做；已有 pending owner 只有取得实际完成证据才算完成。不能找回位置/效果时按 [恢复合同](recovery.md) 读回。

### 二、固化当前 Contract（ER01）

1. 一句话说明用户要的结果，建立 Goal、Constraints、Decisions、Acceptance。记录用户禁止事项、允许运行环境、准确仓库/worktree、工具/路径、安全限制及逐项获准外部影响。
2. 记录实质决策、开放问题和验收标准；已观察事实与假设分开。影响实现的未解决问题不得进入实施放行。
3. task intent 与 eligible output classification 只取直接权威来源。建议内容与 Contract 分开，不能扩大输出资格、替代用户指令或授予范围。
4. 以一个当前 Semantic Contract 和有界 amendment 传递变化，不预读全部 references 或把任务历史当作 Contract。
5. 在 ER01 明确独立验证是否必需及其来源，报告 `independence=required|not_required`；这是 Root 判断，不能用技术字段自证独立或后续临时改名规避。

### 三、核验真实环境与路径（ER02）

1. 先读当前系统、开发者和应用明确的运行元数据，再以实际工具清单、工作区根、权限、沙箱及任务元数据佐证。Shell、模型名、某个工具或 worktree 的存在都不能唯一认证运行时。
2. 当前目标为 Pi，不再让用户填写已取消的多产品环境问卷；不要用浏览器、GUI、截图或视觉页面识别环境。仅检查当前任务授权且非敏感的本地元数据，不输出/持久化令牌。
3. 能力清单逐项记录模型/参数控制、Session拓扑、文件系统与沙箱、工具/连接器、认证和委派返回路径；区分已暴露、未知、必需缺失与可选缺失，记录 `unavailable_capabilities` 及影响。
4. 对每项受保护动作分别记录实际 Session/角色、所需能力/权限检查和来源范围。公共规则接口、请求 scope 或自报身份不是认证，不证明该操作已获准。
5. 只有任务明确要求特定模型/参数时才核验其实际生效；未要求时不增加无关门禁。必需控制未知时暂停依赖工作，不静默替换模型、thinking、工具、权限或 mode/count。
6. 核对准确项目/worktree、文件权限和可用工具；路径存在不证明可写。对可选导航逐项决定：无需/未适配时记录有依据的 `Not applicable` 并直接读取必需 owner；选用导航时只消费当前有界证据，不能把它当作权限、状态或完成回执。
7. 必需 owner 无法读取、必需环境事实矛盾或能力缺失时只阻断依赖分支；只向用户问当前阻塞的具体缺口，不重新询问已明确选择。

### 四、对照已释放的模式和路线（ER03）

1. 通过 `coding_checkpoint status` 回读已锁定的模式、预算和 allocation，并对照实际用户启动指令或答复。此处沿用已释放的 Mode。缺少/过期的已释放证据返回前置 owner；与路线冲突时阻断。
2. Single 要求 `childCount=0` 且无子 allocation。Multi 需要有效的正整数预算，已占用 allocation 数不得超过该预算。
3. 核对 [Session 启动条件](session.md#1-选择并锁定模式) 的用户显式入口、模式/预算及审计答案均已满足。
4. 通过 ER03 只证明当前路线资格，不释放 Slice、不创建代理，也不豁免计划、职责或操作守卫。

按当前锁定路线的 Mode 边界核对拓扑。扩展按实际模式在此加载对应片段。

<!-- rule:current-route#mode-boundary -->

## 输出与落点

返回当前 Contract、环境/能力缺口、已释放 mode/count、路线和导航或 N/A 证据。按当前 revision 顺序完成 ER00–ER03；跨模块依赖交给下一模块，不一批跳过其 Hooks。

## 退出与阻断

- 目标、约束、实质决策、验收、环境/路径和路线资格当前且无冲突，才返回本模块 complete。
- 缺前置、未解冲突、授权不明确或必需上下文无法安全表达时，暂停相应子步骤并说明 owner、缺口和最小输入。
- 本模块不实施、不验证结果、不写文档/Memory，也不执行 Git；建立前置所需写入必须另有授权。

## 重新核验

需求、授权、任务输出分类、环境、能力、路径、Session 或 mode/count 证据实质变化时重新核验受影响 owner；普通汇报不重跑已完成入口。

## 规则来源

| 来源 | 本合同落点 |
| --- | --- |
| [Contract](../references/coding/layer-02-workflow-concepts/entry-and-context/contract.md) | 目标、约束、事实与输出资格 |
| [Environment](../references/coding/layer-02-workflow-concepts/entry-and-context/environment.md) | 明确运行时、禁止GUI探测及冲突 |
| [能力清单](../references/coding/layer-02-workflow-concepts/entry-and-context/environment-capability-inventory.md) | 必需/未知/可选能力与依赖阻断 |
| [Pi运行时](../references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md) | 真实工具、模型与宿主边界 |
| [入口就绪模块](../references/coding/layer-04-workflows/modules/entry-readiness.md) | ER00–ER03顺序、允许效果与当前证据 |
| [模块入口解析](../references/coding/layer-03-workflow-checkpoints/module-entry-resolution.md) | 模块声明、缺前置与恢复 |
| [路线入口](../references/coding/layer-03-workflow-checkpoints/route-entry.md) | 只消费已选路线 |
| [Mode](../references/coding/layer-02-workflow-concepts/entry-and-context/mode.md) | 已释放拓扑证据 |
| [Single-Agent 路线](../references/coding/layer-04-workflows/coding-single-agent.md#mode-边界) | 单代理模式边界 |
| [Multi-Agent 路线](../references/coding/layer-04-workflows/coding-multi-agent.md#mode-边界) | 多代理模式及锁定预算边界 |
| [Coding selector](../workflows/coding.md) | 未启用扩展的入口回退 |
