# 中断、前置补证与原位恢复

## 触发条件

- paused/blocked、工具 abort/失败、效果未知、会话加载/恢复、树导航、压缩、新用户输入或 user_bash 后。
- 模块返回缺前置、owner 仍 pending、相关 epoch 失效，或需要从修复/验证/文档/交付回环恢复。
- 本 Hook 不自行选择路线、恢复权限或重跑任务；只确定可安全继续的准确位置。

## 输入与证据

当前 Contract、模式/预算、实际 Session 和工作目录、模块/子步骤及 revision、先前完成证据及 epoch、已尝试/已完成/未知效果、待处理 owner、外层 continuation、计划具名指针和当前性。真实文件效果不会随着对话分支回退。

## 执行要求

### 一、先保存位置和效果，不猜测空白状态

1. 模块调用前核对声明中的范围、允许效果、授权、前置证据和新鲜度。首次直接入口没有历史不是失败，但必须在产生效果或暂停前建立 continuation。
2. continuation 保留待处理模块/子步骤、授权范围、带来源和 epoch 的已完成证据、尝试/完成/未知效果，以及外层返回位置；不能只记“从头再试”。
3. 父级实时 mode/count/allocation/Slice 属会话调度状态，不写共享计划/memo/其他 Memory。扩展快照只是 Pi Session 记录，不是数据库事务、身份或权限证明。
4. 会话树、fork、压缩和重载不能回退磁盘或已占用名额。合并当前分支位置与 Session 已绑定 allocation，不能把旧快照空预算当作新授权；状态损坏/归属不明时暂停而非重建空状态。

### 二、未知效果先在原授权内读回

1. 工具错误、超时或 abort 不证明“未执行”；失败写入可能已部分完成。先核对实际调用结果、收据和精确目标文件/外部状态，再判断效果。
2. 读回本身须已有授权；优先最小 read/check，不为排查扩大写入。没有足够读回能力就阻断，不能用假定成功/失败继续。
3. 区分完成、部分完成、明确未运行、仍在运行和未知。保留已完成效果，补做尚未发生且仍获准的部分；不要自动重复提问、创建、Memory写入、文件写入或Git。
4. 一次性子任务的失败/未知不能通过重派来“找回结果”，也不能释放名额；实际正文缺失先从真实来源读取。只有宿主明确证明未运行时才可按实际支持撤销未绑定预留。
5. 暂停前的旧观察不能证明暂停后的状态；恢复需暂停后真实 read/check 证据。未知效果处理完成仍不自动补授权。

### 三、按语义 owner 补证，在记录处继续

1. `complete` 只表示本模块所有必需 owner 已满足当前通过条件并附证据/效果/epoch，不等于整条路线验收。待提问、待审计、pending 或未解前置均不能 complete。
2. `not_applicable` 仅在条件触发器实际不存在时成立，附观察和原因；不能用来跳过必需项。
3. `needs_prerequisite` 逐项指出缺失的语义 owner 与证据，调用者补齐后回同一位置。通过 `coding_checkpoint report` 使用 `needs_prerequisite` 或 `blocked`；主动暂停用 `pause`。先用 `resolve_effect` 结合实际读回处置未决调用，再以暂停后成功的 read/check 证据执行 `resume`。
4. `blocked` 明确冲突、必需证据/能力缺失或不安全状态及解除条件。仅当位置丢失、状态矛盾或授权读回仍不能确定效果、无法安全继续时阻断恢复，不把可补齐的前置误写成全任务永久失败。
5. 补证所需的写入仍要独立授权。不要为前置重新启动无关已完成门禁、重复 Mode 选择或在模块内部调度兄弟模块。

### 四、撤销旧放行，重核受影响验证

1. 中断后旧 Slice 撤销，重核当前范围、前置、权限和返回条件后才放行新的 Slice；恢复坐标不等于恢复写入许可。
2. 内容、文档或 Git 维度变化使受影响 Verification/Acceptance 失效；对当前状态取得新检查证据，不复用旧 epoch 的通过结论。
3. 修复保留外层 continuation：先范围门禁，再执行窄修复，再回 Verification；不能覆盖原 documentation/delivery 返回点。
4. 文档写后回验恢复 DOC04，Git 后回验恢复 DA03，保留已确认效果。决策补证按调用方位置完成 WD01–WD03 的适用检查，报告批次止于原检查点。DA05 已有归档时，补证至 WD02 即返回，保留归档。能力变化在原位置重核，实质需求变化才回入口重核。
5. 共享计划在实质变化、交接、暂停/完成边界按 [计划合同](planning.md) 更新；影响授权/范围/验收/方向/依赖动作的事实先分析并确认计划更新，再放行。普通模块切换不单独要求写入或全文重读。

### 五、区分合法回环和无进展循环

1. 同一前置被重复解析且没有新证据、epoch 或有效 owner 状态变化才是循环；有真实证据推进的修复/重验可继续。
2. 只在 Pi 真实最终可行动边界且正常可继续时请求有限 continuation，每次用户启动/继续最多8次；无检查点进展停止并说明缺口，不自建 Shell/agent_end 循环。
3. 等待、异步收集、取消或 resume 只用实际扩展能力。同步调用已返回终态就直接审阅，不伪造 wait/持久 Session，也不重放调用模拟异步。
4. 已完成历史仍保留，但后续文件/授权变化后不再证明当前状态。不要将终态任务隐式改为 active 或借 off/on 重置名额。

## 退出与阻断

有准确恢复位置、暂停后当前读回、已解决的效果状态、有效授权与受影响 epoch 证据后，在原 owner/子步骤继续。任一必需条件缺失则保留最后确认版本和阻断原因；不标路线完成，不自动扩容或重派。

## 重新核验

每次恢复、补证、规则/源码 Hash 变化、Session/目录变化、树导航和新增效果后，只重核相关前置/epoch。Hash 相同也不认证语义或授权，Hash 变化更不能自动抹除历史效果。

## 规则来源

| 来源 | 本合同落点 |
| --- | --- |
| [工作流模块契约](../references/coding/layer-01-fundamental-concepts/execution-planning/workflow-module-contract.md) | 声明、四结果、continuation、补证和不重放 |
| [模块入口解析](../references/coding/layer-03-workflow-checkpoints/module-entry-resolution.md) | 直接入口与准确暂停位置 |
| [委派状态记录](../references/coding/layer-01-fundamental-concepts/delegation/delegation-state-record.md) | 会话模式、名额与任务事实 |
| [任务计划生命周期](../references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md) | 边界更新、保全与限制 |
| [验证epoch](../references/coding/layer-02-workflow-concepts/verification-and-repair/verification-epoch.md) | 当前状态和验证失效 |
| [Extension使用说明](../PI_EXTENSION.md) | Pi真实事件、有限续跑及DOC04/DA03恢复 |
