# 交付与 Acceptance Hook

本合同覆盖 Git 交付效果（若明确请求且逐动作授权）及逐标准 Acceptance；不授予实现、文档、提交、推送或其他权限。输入为当前 Contract 全部标准、最新 implementation/content 与 documentation Verification、各自范围/指纹/epoch、Git 目标/效果意图、当前已完成效果和 continuation。未请求 Git 不影响 Acceptance，须记录有理由的 N/A。

## 触发条件

当路线进入最终交付或 Acceptance，或用户明确请求 Git 动作时触发。先核验准确仓库/worktree、分支或 ref、remote（如适用）、操作种类、计划影响、当前 Git 状态/历史及已验证指纹。当前内容和文档 Verification 必须覆盖最新适用 epoch；缺失/过期时不执行 Git，返回对应 Verification owner。每一项 Contract criterion 必须明确可定位，缺少、歧义或冲突时向调用方澄清，不能自行补充标准。

Git 授权逐动作判断：commit、push、branch/ref、index、remote 配置及其他本地/远程效果各自检查用户对准确目标、操作和范围的明确授权；某个动作的授权不扩展到其他动作。既有授权仅在原范围内持续有效，不因换工具重复询问。目标不明、授权缺失、权限拒绝、前置条件失败或不安全冲突时停止受影响动作。无需 Git 的只读检查不需要伪造 Git 授权。

## 执行要求

### 一、精确Git目标、已验证内容和实际效果

Git 前检查 status 和相关历史，识别并排除用户无关改动；暂存/提交内容必须与最新已验证指纹一致且不含未验证内容。任何差异都须在继续 Git 前返回受影响的 implementation/content 或 documentation Verification。准确记录实际目标、动作、结果和 Git metadata epoch。Commit/index/branch/history 的 metadata 变化本身不使内容/文档 epoch 失效；实际内容变化则必须重新分类和验证。Git 调用结果不明时不得盲目重放，先确认实际状态。

### 二、区分直接能力和缺失的职责适配

Git 能力按动作分类。简单且当前宿主实际可用、能精确满足已授权操作的 Git 工具可使用。非简单 Git 职责（例如复杂历史/冲突处理、需跨多步协调或工具无法可靠表达的影响）须由适配器/专用能力承接；当前无适配器时阻断该动作并说明缺口，不能降级为普通文件、capsule、脚本或另一入口绕行，也不能声称已完成。工具可用不代表授权，授权不代表工具存在。

### 三、逐项Acceptance，不把缺证据写成通过

Git 未请求时记录 `not_applicable` 并跳过写动作，继续 Acceptance。随后逐项映射每个标准至其适用的最新 implementation/content、documentation、Git metadata epoch 证据；分别报告通过、失败、未运行、不可用、假设、授权项目及剩余风险。适用性有争议时不得假定通过。失败 criterion 阻断 `COMPLETE`；必需证据缺失、未运行、不可用或未知则返回对应 owner 获取证据，不得以假设补足。

### 四、先保全计划全文，再无损归档

所有标准通过后，检查是否存在匹配且已完成的 active plan。计划归档遵守 owner：取得当前完整计划基线，对它作局部完成更新并追加最终状态、结果/Acceptance证据与限制，保留旧事实、失败和被替代决定，不以最终摘要替换累计全文。先按owner选定路径取得匹配的已核验回执或完整内容比较，确认最终更新未丢失此前累计内容；再将这份已核验的最终活动内容作为归档字节比较基线。确认准确已验证仓库存储范围、相同 key 和归档目标未占用；目标碰撞阻断，不覆盖/编辑归档。仅移动名称/命名空间，按适用 owner 的核验路径确认归档存在、活动项消失、归档字节内容与最终活动内容完全相同。不得改用其他仓库、scope或本地副本；repository-id/存储映射变化先回规划owner，不静默迁移。逻辑命名为同一仓库scope中的 `plans/PLAN-[short-english-summary]` → `archive-plans/PLAN-[short-english-summary]`；只移动名称不改变正文。不编辑已有归档来修复不一致，不删除碰撞目标；不得把普通文件当计划Memory后端。必需 Memory 能力/权限/核验不可用时阻断并报告。无活动计划只有在记录的持久化限制确实适用时才 N/A；不匹配或未完成计划不归档。

## 退出与阻断

`COMPLETE` 仅在每项标准有最新且适用的通过证据、范围准确、所请求且授权的 Git 效果确认与验证指纹一致、无未解决必需能力/授权/证据问题后可返回。报告分别列出内容、文档、Git metadata 状态，Git 结果或未请求原因，逐 criterion 的证据映射，计划归档结果/适用 N/A、限制与风险。验收失败、冲突或不安全状态为 `blocked`；缺少当前 Verification、标准、授权、工具/适配器或必需计划证据为 `needs_prerequisite` 或 `blocked`，注明责任 owner 与准确恢复条件。不可用、失败、未运行不得改写为通过。

## 重新核验

Git 之后重新核验实际目标、状态、效果及暂存/提交指纹，再于 DA03 逐标准映射 Acceptance；不得重放 DA02 已完成动作。Git 只变 metadata 时保留仍新鲜的内容/文档 Verification，并以指纹说明；检测到内容差异则返回受影响 Verification 后再回 DA03。每项标准的相关内容、文档、Git 状态变化都使其适用证据重新核验；无关维度不重跑但记录复用依据。计划归档后若结果不明，先读取/核对实际状态及同 scope/key 内容，不重复移动；字节不一致、活动项仍在或目标异常均阻断，保留最后确认状态并交由另行授权恢复。变化只补核受影响条件，不重放已完成 Git/计划效果。

## 规则来源

| 来源 | 本合同落点 |
| --- | --- |
| [completion-and-effects/git](../references/coding/layer-02-workflow-concepts/completion-and-effects/git.md) | 准确目标、状态/历史、指纹、分离授权及 metadata epoch |
| [completion-and-effects/acceptance](../references/coding/layer-02-workflow-concepts/completion-and-effects/acceptance.md) | 逐标准证据映射、分维度报告与 COMPLETE 门槛 |
| [modules/delivery-acceptance](../references/coding/layer-04-workflows/modules/delivery-acceptance.md) | DA00–DA05、全文保全、DA02 Git与DA03 Acceptance返回 |
| [Session职责](../references/coding/layer-01-fundamental-concepts/session-runtime/session-role-ownership.md) | 非简单Git的单独职责与授权 |
| [Verification Epoch](../references/coding/layer-02-workflow-concepts/verification-and-repair/verification-epoch.md) | Git metadata与内容/文档维度分离 |
| [execution-planning/task-plan-memory-lifecycle](../references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md) | 全文保留、scope/key、同内容归档与只读既有归档 |
