# Pi Coding Workflow Extension

本文保留旧扩展的历史行为，不是当前安装、运行或验证指南。归档快照（仓库检出中：`archive/pi-coding-workflow/README.md`）不可安装或运行；需要复现时仅使用独立历史检出。当前 Skill 按路线与 Hook 合同执行，不加载归档，MCP 与第三方子代理工具按各自入口独立核验。

旧扩展曾向 Pi Coding Agent 提供所选 YAML 路线及适用的 Hooks。Agent 自行处理阶段条件、验证回环与交付。扩展维护工具调用约束、真实回执和会话预算。

## 试用与安装

历史基线为 Pi Coding Agent **1.5.2** 和 Node.js **24+**，使用 Pi 提供的 `typebox` 等宿主模块，不复制宿主依赖。旧安装和加载流程仅见归档前提交中的本文，不适用于当前仓库。

## 启动与控制

旧扩展默认不接管会话，不按自然语言关键词猜测模式。以下是历史命令示例，当前仓库不提供这些命令：

```text
/coding start 实现某项已明确的改动
/coding single 实现某项已明确的改动
/coding multi 实现某项已明确的改动
/coding multi 2 执行两类已授权且职责不同的任务
/coding status
/coding pause
/coding resume
/coding off
```

启动入口共用 `startup.ts` 单一固定顺序问题注册表：**模式/预算 → 审计可见性**。有效显式字段不重问。审计菜单可选择使用默认或定制三个字段；默认值为 `audit_mode=balanced`、`root_reasoning_cadence=milestone_only`、`worker_reasoning_cadence=full`，逐字段记录 `explicit/default` 来源。默认预设只填缺失字段。取消、未回复或无效值不隐式默认；答案未齐时不创建 Workflow。CLI 启动未完成时允许已知只读工具，暂停可能产生副作用的调用。手动启动失败或取消后，未启用的扩展恢复被动。`/coding cancel` 取消正在收集的启动，Session/树导航使迟到答案失效，并发启动拒绝而不重复创建。

没有暂停或未决效果时，用户可以在同一 Session 显式开始新任务。任务目标留在 Pi 对话中。已确认答案跨新任务、树导航、reload/resume 保留，不重复提问或回收预算；fork/new Session 重新收集。审计偏好进入状态、context、status 和子任务 bundle，只控制安全摘要策略，不证明完整日志访问、不披露私有思维链、不改变权限或独立验证。

- `single` 对应 `child_count=0`；`multi` 未填数量时为1。选择模式、预算或 task 不代表授权写入、Memory、联网或实际创建代理。
- 同 Session 锁定模式/数量；此版不提供会话内切换模式。新模式使用新 Session，不通过重启任务重置名额。
- 名额用尽后，仅用户明确 `/coding add-slot Change Verification` 等完整、不同职责名时增加一个；已绑定角色不能重复，终态不释放预算。
- `resume` 先唤醒 Agent 按恢复 Hook 读回实际效果，再按当前证据恢复；不会自动重放命令。`off` 是用户明确退出协调器，不是安全沙箱开关，不能据此宣称原任务已完成。

非交互/print/RPC 可在真实用户 prompt 前显式选择：

```bash
pi -e /absolute/path/to/token-io-decoupling-for-pi \
  --coding-mode single --coding-audit-defaults -p '在授权范围内完成任务，先核验约束'
```

非 UI 必须显式提交模式及审计答案，缺失时清晰阻断；不能让模型代选。`--coding-count 2` 用于 multi。审计显式 flags 为 `--coding-audit-mode economy|balanced|full`、`--coding-root-cadence full|milestone_only|off`、`--coding-worker-cadence full|milestone_only|off`；`--coding-audit-defaults` 明确接受未提供字段的默认值。命令入口在任务前使用去掉 `coding-` 前缀的参数，例如 `/coding multi 2 --audit-mode full --audit-defaults 任务` 或 `/coding start --mode single --audit-defaults 任务`。任务以 `--` 开头时用独立 `--` 分隔。`--coding-volatile` 不额外追加扩展状态，但 Pi 自身会话日志需另用其 `--no-session` 等设置管理；volatile 仅保留当前进程内答案/预算，扩展重载或跨进程 resume 无恢复证据时须新 Session，不依赖日志伪称可恢复，不得将丢失状态当作空预算继续。默认状态只追加到实际 Pi Session，不另建数据库、不写 Serena Memory。

## 工作流路线与工具

两条 YAML 路线绑定七个主阶段的 Hook。Pi Agent 根据当前动作和证据判断适用项、补证、修复及回验，并在对话中保留必要的恢复信息。

| 工具 | 可执行内容 |
| --- | --- |
| `coding_checkpoint` | `rules` 读取 YAML，`status` 读回会话事实，`result` 分页读回实际结果。`pause`、`resolve_effect`、`resume` 只用于暂停和异常恢复。 |
| `coding_slice` | 登记 Objective、精确路径及影响、Return conditions、Unreleased boundary，并引用实际证据。 |
| `coding_run` | 声明实际调用的影响和依据，经 `ctx.executeTool` 进入 Pi 工具校验、权限与 Hooks。 |
| `coding_delegate` | 核对锁定模式、预算、唯一职责、当前 Slice 和实际 Schema 后调用兼容的一次性子代理工具。 |

每次模型请求注入所选路线的操作正文、由会话状态及可观察事件触发的合同和最近 24 项回执。对 `coding-rule:文档#片段`，使用 `coding_checkpoint rules` 指定 `document` 和 `fragment`。省略 `fragment` 时返回 Hook 的执行合同及可查询片段，省略 `document` 时使用所选路线。整个上下文包上限为 96,000 字符，超限时暂停依赖操作。

## 事件与会话状态

`tool_call` 核对已登记的 Slice、精确路径和工具入口。`tool_execution_end` 记录实际结果和受影响 epoch，实际运行但失败的写入也会保守失效。Bash、codemode 和 MCP 的影响由 Agent 显式声明，外部进程或绕过宿主事件链的副作用需从实际来源读回。

Git 前按交付 Hook 核对单独授权、准确目标及适用检查，并在 `coding_run.verificationEvidence` 引用与当前内容和文档一致的成功检查回执。工具调用时直接校验这些回执。仅 Git 元数据变化时，Git 前置仍可复用这些回执。验收充分性由 Agent 根据合同及真实结果判断。

普通用户输入和回合结束撤销旧 Slice。Agent 根据当前范围申请新的放行。压缩保留当前宿主状态。树导航、中止和未知效果按恢复 Hook 读回。v3 会话账本只保存会话与目录绑定、模式及审计、预算、名额、未决调用和规则指纹等恢复必需事实。任务正文留在 Pi 对话里，Slice、证据版本和最近回执留在当前运行内。v1/v2 旧记录只迁移恢复所需事实。恢复后重新核对效果和当前范围。


## 多代理支持边界

- Pi 不内置子代理。委派支持 `@mjakl/pi-subagent@3.1.0`，并校验实际暴露、可调用的 `calls[]` Schema。每个 job 生成一次 `calls: [{agent, prompt, cwd, initialContext: "empty"}]` 宿主调用，不传 `session`。未知形状、额外必需字段或不能表达空上下文的接口在预留前拒绝。必须先发现工具和配置名，不按产品名猜 Schema。
- 实际能力和创建前置必须在委派前核验。一次性调用完成创建、派发、执行和返回。主 Agent 按委派 Hook 审阅完整结果。独立验证使用真实支持的只读 verifier。
- 多任务只对独立、无共享写入冲突的任务并行；不以终态回收预算。Root 必须向 task 提供准确来源、计划/Memory 名称、贡献范围及必要限制，不能把前置判断交给 worker。
- 此版没有持久子会话复用、任意异步扩展、Git 专用子代理或 OS/进程级隔离适配器；需要这些能力的分支明确阻断。外部 worker 的工具链是否继承限制须单独核验，提示词不是沙箱。
- 大结果可分页读取，不能只接受状态/摘要。分页缓存仅当前进程；重载后需从真实来源读回，不能重派任务来恢复丢失结果。

### 角色描述与按任务选型

仓库 `agents/*.md` 为中文描述源：worker对应Primary Output，reviewer对应Change Verification，scout对应Context Bootstrap/Refresh；planner保留名称但不产生第五职责，在Coding仅可作获准中性Context整理的别名，Root前置决策/计划不能外包。git-operator描述第四职责及阻断条件，不代表本适配器支持Git委派。

Root 核验当前端点和实际工具能力后选型，可参考[三模型卡](../skill/references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md#子代理模型与推理强度参考)。其他精确模型按宿主 Schema 转发。每个 `calls[]` 项独立设置 `model` 和 `thinking`。协调器将显式选择拆为 `model: "provider/id"` 和 `thinking`，调用档位覆盖代理配置及启动默认值；不改Root。选型与对应Schema能力在任何任务预留/执行前核验，不支持时拒绝，不钳制/回退。

通过本协调器派发时，`coding_delegate.jobs[]` 可提供 `model` 与简短 `modelReason`。有显式选择而目标Schema不支持对应model/thinking字段或档位时，在预留前拒绝，不降级为仅在任务正文里写模型名；省略时不补model/thinking字段，保留目标工具的真实默认/继承行为，Root须如实记录能力限制。modelReason只是Root依据，不证明选型充分。精确模型/档位由宿主调用记录核验，不要求Worker自报。

源描述和模型卡核对记录位于仓库 `agents/`、`integrations/pi-subagent/`。加载本package不自动覆盖用户代理配置；部署属于单独明确授权的用户级文件修改，更新后需用户 `/reload` 或新会话，重新发现Schema。不能把磁盘变化当作当前会话已生效。

## 规则迁移边界

扩展启动时从 `docs/rules/` 中的 YAML 建立索引和快照指纹，按需读取路线和 Hook 执行合同。编译器独立生成用于阅读和手动回退的 Markdown。来源和归属由 [逐篇来源整合对照](../skill/hooks/SOURCE_COVERAGE.md) 的离线检查核验。规则摘要和路径覆盖用于核对版本及归属，细节冲突以 owner 及更高优先级规则为准。

宿主校验字段、实际回执引用、预算、路径和 epoch。它不证明用户授权、检查输出正确、独立性、N/A 理由、内容保全或验收真的满足；不透明工具的 effect 也是声明。它不是恶意代码沙箱或 OS ACL。真实出站、Git、Memory 权限仍按原规则独立核验。

MCP 独立于旧扩展；使用前分别核验实际工具注册、可信调用方绑定和操作授权。

## 离线验证

本节只记录归档前的检查范围；旧测试和宿主检查命令不再由当前仓库提供。仅在独立历史检出中参考当时的验证命令。当前维护范围见 [静态代码检查](STATIC_CODE_CHECKS.md)。

宿主类型与加载检查复用已有 Pi/TypeBox/Jiti 和 `tsc`。3.1.0 契约检查使用真实注册 Schema 验证适配参数、参数规范化、模型和推理档位 CLI 及失败 Hook。也可用 `PI_EXTENSION_HOST_ROOT` 指定包根，`TSC_BIN` 指定已有编译器。真实客户端、实际子代理、Memory 后端及 API 的端到端验收仍需独立环境与授权。
