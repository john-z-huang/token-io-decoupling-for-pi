# Coding Hooks 触发目录

这些文件是由 `extensions/coding-workflow` 的实际 Pi 回调选择并注入的执行合同，**不是仅因文件名叫 Hook 就自动执行的 Markdown**。每份均定义触发、执行要求、退出/阻断、重新核验与详细 owner 来源；不得因压缩中省略细节而推导豁免。

用户启动与安装见 [Extension 使用说明](../PI_EXTENSION.md)。不启用 Extension 时，Skill 仍通过 [Coding selector](../workflows/coding.md) 定向消费原 owner。

## 合同与明确触发

| Hook | 触发条件 | 执行内容 |
| --- | --- | --- |
| [foundation](foundation.md) | 已启用扩展的每次模型请求 | 共享 Contract、真实来源、授权、禁止 Computer Use、数据与模型边界。 |
| [entry](entry.md) | entry；requirements_changed/capability_changed | 核验任务/约束/验收、实际环境与工具、已选模式及路线。 |
| [session](session.md) | session；能力变化 | 核验当前 Session/角色、模式/预算、实际扩展能力。 |
| [planning](planning.md) | definition 及实施/验证/文档/交付边界；决策/需求变化 | Context/Decision、Memory scope/repo key、默认共享计划、增量保全和单写者。 |
| [execution](execution.md) | execution；Slice/Control 边界 | 放行四字段、精确影响范围、阶段反馈、Continue/Amend/Stop。 |
| [delegation](delegation.md) | multi execution；实际委派前 | 任务/输出资格、唯一职责/预算、一次性调用、结果正文、不重派。 |
| [context](context.md) | definition/documentation/multi execution；context_exchange | Capsule/memo/共享计划区分、获准具名访问、来源与 Handoff。 |
| [audit](audit.md) | session、multi execution 及已有 allocation 的实际返回审阅 | 安全摘要偏好、实际结果正文、不可伪造消息/日志。 |
| [verification](verification.md) | verification；文档/Git 回环 | 最终状态、当前 epoch 检查、独立性、类别/结果/缺口。 |
| [repair](repair.md) | verification；repair_required | 修复范围门禁、Contract 改变回 Decision、修复后重验。 |
| [documentation](documentation.md) | documentation；documentation_impact | Root/Skill 输出边界、文档影响、检查及原位置恢复。 |
| [delivery](delivery.md) | delivery；git_changed | Git 独立授权、逐标准验收、计划保全/字节相同归档。 |
| [recovery](recovery.md) | paused/blocked/未知效果；生命周期中断 | 准确 owner/位置、实际读回、撤销 Slice、不重放、有限续跑。 |
| [navigation](navigation.md) | entry；当前导航需求 | 可选导航的直接 owner 路径、不伪造未适配服务能力。 |
| [advisory](advisory.md) | advice_requested | 外部建议的最少事实、独立出站授权、API 配置/模型边界。 |
| [materialization](materialization.md) | materialization_requested | 候选预检与真实应用分离、可信身份/grant、守卫失败不绕过。 |

表中语义条件通过 `coding_checkpoint signal` 上报。宿主不能自动证明任务改变、验证充分、授权真实或 N/A 合理；Agent 负责识别并提供实际来源。工具错误也只自动引导能力/环境核验，不能被重写为可跳过门禁。

## 真正的宿主回调

| Pi 事件 | 扩展执行的动作 |
| --- | --- |
| before_agent_start | 保留其他 system prompt sections，仅添加 Coding 简短引导；显式 CLI flag 可从真实用户 prompt 启动。 |
| context | 计算当前 Hook 集合，替换本扩展旧包，注入当前模块清单、有限观察与相关合同，不删除其他扩展消息。 |
| tool_call | 约束内置写入路径/Slice、子代理入口和不透明调用包装；不凭 Shell 关键词或 readOnlyHint 证明安全。 |
| tool_execution_end | 绑定实际调用证据；已运行写入即使失败也保守失效 epoch；被阻断而未运行的不冒充实际效果。 |
| session_start | 按真实 Session 与当前 branch 还原位置，核对版本/目录/规则 Hash；不继承另一个 Session 的身份。 |
| session_tree | 分支位置与会话级已占预算分开恢复，不能把树回退当作文件系统/预算回退。 |
| session_compact / input / user_bash | 撤销旧 Slice、保留暂停位置，要求按当前事实核验；用户 Shell 影响未知时保守失效。 |
| agent_before_settle | 仅正常且可继续时有限续跑，最多8次；无检查点进展时停止。 |
| agent_settled | abort 时暂停并要求读回，不在通知边界启动循环。 |

## 维护与验收

- `catalog.ts` 绑定16个 Hook、8个模块文件、两条路线和现有检查点 ID，登记非 Hook Markdown 的规则/导航/参考归属。新增顶层规则目录或改变检查点形状须同步审阅映射/引擎，不能只改文字后声称兼容。
- `npm run check:hooks` 检查来源链接、归属和默认上下文字符上限；`npm test` 检查状态转换、门禁与模拟事件；宿主声明/入口 smoke 另见使用说明。
- 覆盖率和 Hash 只说明文本/归属/形状，不证明压缩合同逐条语义等价。详细 owner 保留权威；扩展不是新的授权来源、OS 沙箱或完整静态副作用分析器。
- 原生/其他扩展工具是否经过当前事件链必须实际核验；不可观测的外部操作通过真实读回与语义信号处理，不伪造自动检测。
- 本轮不修改 MCP Server，也不因本地 Hooks 测试通过宣称服务端身份、结构预检、物化或安装接入已经完成。
