# Verification Hook

## 触发条件

当需要判断当前交付状态是否满足 Contract、验收标准或依赖路线的放行条件时适用；包括实现完成后的最终验证、修复交接后的重验，以及文档或 Git 状态变化后的相应核验。入口不要求已有最终 Verification 结果。开始前确认当前任务范围、当前 Contract/验收条件、实际实施结果、Session 身份与 authority、调用方 continuation，以及已经发生的效果均可识别；不得把未知、部分或相互冲突的状态当作已解决。Single-Agent 或 Multi-Agent Mode 的适用释放证据须为当前有效。

本 Hook 汇总验证证据、独立性、报告和 epoch 规则；它不授予独立验证者权限，不授权修复，不代表整体验收，也不取代直接 owner 的决策。调用方未提供必需的 Contract、范围、实际状态访问、验收条件或来源/效果事实时，报告 `needs_prerequisite` 并明确缺项；状态不安全、冲突不可解或效果无法恢复时报告 `blocked`。不因本 Hook 入口重新要求已经有效且范围未变的授权。

## 执行要求

### 捕获当前状态与覆盖维度

扩展追踪观察到的 epoch，Root 另外核验真实状态指纹和覆盖标准。VR03 需要同一当前 epoch 的实际 `check` 成功观察，并上报 `facts.verification=passed`；VR06 若发现 epoch 已变化就回 VR01。可按 owner 复用未受影响维度的证据，仍需为当前扩展验证提供有效观察并解释覆盖面。

1. 以实际工作区/目标资源为准，先解决部分、冲突或不确定的应用状态，再捕获准确的最终状态指纹（fingerprint）和 epoch；预检、实施收据、候选文件、早期检查及代理声称均不是最终状态证据。若输出物料化流程提供收据，须按实际当前文件核验收据，不能以收据替代状态读取。
2. 把每项验收标准映射到当前证据、检查及覆盖维度；至少分别追踪 `implementation/content`、`documentation`、`Git metadata`。代码、配置、测试及其他产品验证覆盖内容变化推进 implementation/content epoch；维护中的文档、注释变化推进 documentation epoch；若文档改动可执行内容、Contract 或验收条件，也推进 implementation/content epoch。commit、branch、index、history 等 Git 状态变化推进 Git metadata epoch。单纯 Git metadata 变化不自动推进前两维，但 Git 检查仍须确认 staged/committed 内容与最新已验证指纹一致；差异或包含未验证内容时返回对应维度重验。
3. 每一维只复用指纹未变化且覆盖该标准的当前有效证据。变化只使它实际影响的维度过期；不得在受影响维度使用旧通过结论。对文档变更运行适用的Markdown、链接/标题锚点、空白、当前项目语言约定及范围检查；本仓库中文单源，不运行双语维护检查；具体内容变化运行其适用产品检查。依据直接状态证据判断覆盖维度。
4. 路线提供的 `verification-impact` 仅为覆盖建议。须核对其适用性、授权、当前指纹和直接 owner；建议不可用、不符条件或与直接证据冲突时，记录有根据的 `not_applicable`/原因并按直接证据确定必需覆盖，既不能把建议当结论，也不能以其免除检查。

### 独立性

依 Contract 判断是否要求独立 Change Verification Session。要求独立时，验证须由获授权且身份/职责得到确认的独立验证者完成；仅提供其获准的计划、来源范围、验收标准和验证所需证据；除明确点名的验证资产外，对产品代码/配置、文档和Git只读，不修复或编辑被验证实现。当前只读适配器不能表达的写验证资产能力不能冒充已支持。Multi-Agent Worker/子代理的实现结果、正文、完整可见记录或复用，不是独立验证。实施者不能为自己的实现自证“独立”：同一 Session 的检查只能标为逻辑验证，不得因换名称、拆步骤或读取代理结果变成独立 Session。若没有独立验证者或证据，报告 `needs_prerequisite`；不得宣称满足 Contract，依赖工作继续阻塞。Contract 不要求独立 Session 时可将同 Session 检查标为逻辑验证，并说明独立性 `not_applicable`，此处不等于验证本身通过。

### 检查与报告

针对准确的当前指纹，执行覆盖全部验收条件的适用最强整体检查及定向检查，并对变化维度执行所需检查。保留命令/检查名称、结果和证据出处；必需检查不可运行或访问不到时记为不可用及原因，不能记作通过。报告至少包括：当前指纹；三个维度各自的 epoch/变化/证据新鲜度；验收条件与检查映射；独立性要求、Session/职责证据及分类；每项检查名称、结果类别、证据；剩余风险；每个未解决项目、责任 owner、缺失证据/能力及阻塞影响；Repair 是否适用及依据；当前 continuation/下一步。

逐项分类，不合并或遗漏以下类别：`通过`（证据当前且标准满足）、`失败`（具体反证或检查失败）、`不可用`（必需检查/资源无法取得并注明原因）、`假设`（未证实的前提及其影响）。不可用、假设或缺失的必需证据不是通过；“无失败”也不等于验收完成。报告应明确剩余风险、未解决项及其对依赖动作的阻断关系。检查收据只是证据，不是 Verification 结论。

## 退出与阻断

只有所有必需验收项对当前状态均有有效证据、必需检查通过、必需独立性已满足，且无未解决的必需失败/前置条件，才可返回验证 `complete`。这仅表示本次当前 Verification 完成，不单独宣布整体交付验收或授权后续效果。

具体失败时上报 `repair_required` 以加载修复合同。须有失败证据、受影响路径和最小修复候选；在范围门禁通过前不得修改。没有具体失败的语义或范围变化不能伪装成 Repair，应回调用方重审 Contract/Decision。必需检查不可用、独立验证缺失、状态/指纹/标准证据缺少时返回 `needs_prerequisite`；冲突、不安全或授权边界不明时 `blocked`。任一必需失败、未批准范围变化或待修复状态均阻断依赖工作。不得以修复意图、成功的聚焦检查或旧通过结果解除阻断。

结果状态至少使用：`complete`（本次验证所有必需条件满足）、`needs_prerequisite`（列出可补足的前置条件、owner 和 continuation）、`blocked`（说明无法安全继续的冲突/边界及阻断范围）。在证据不全时不能用 `complete`。

## 重新核验

任何修复或其他状态变化后，按实际影响推进 epoch，捕获新最终指纹，并回到当前 Verification；修复 handoff 不能直接宣告通过。重跑变化维度及其所覆盖标准所需的整体/定向检查；未变且证据仍匹配的维度可保留，不作无关全量重跑。文档、内容和 Git metadata 的变化分别按上述维度处理；Git staged/committed 内容与最新验证状态不一致时，重验相应内容维度并确认 Git 检查。

资源、授权、Contract、验收条件、状态证据或独立性证据变化时，只重新核验受影响的条件；旧证据若指纹或覆盖标准已不匹配即失效。依赖动作前，必须已有当前可用的必需 Verification；若当前验证记录持久化或 owner 要求的回读/核验失败，阻断相关依赖边界并如实报告，不推测成功。调用方续行须接收当前结果、owner 与 continuation。

## 规则来源

| 来源 | 本合同落点 |
| --- | --- |
| [verification.md](../references/coding/layer-02-workflow-concepts/verification-and-repair/verification.md) | 当前指纹、验收映射、整体/定向检查、必需证据与非整体验收边界 |
| [verification-epoch.md](../references/coding/layer-02-workflow-concepts/verification-and-repair/verification-epoch.md) | 内容、文档、Git metadata 三维 epoch、证据失效及重验 |
| [verification-independence.md](../references/coding/layer-02-workflow-concepts/verification-and-repair/verification-independence.md) | 独立 Session、逻辑验证、实施者不得自证独立及阻断 |
| [verification-reporting.md](../references/coding/layer-02-workflow-concepts/verification-and-repair/verification-reporting.md) | 通过/失败/不可用/假设、风险、未解决项与阻塞报告 |
| [repair-disposition.md](../references/coding/layer-03-workflow-checkpoints/repair-disposition.md) | 具体失败路由、无失败 Repair N/A、重大决策返回及变更 epoch 重验 |
| [verification-repair.md](../references/coding/layer-04-workflows/modules/verification-repair.md) | 模块入口、输入输出、当前状态流程、结果状态与交接循环 |
