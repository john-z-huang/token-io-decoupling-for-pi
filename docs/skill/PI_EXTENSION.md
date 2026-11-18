# Pi Coding Workflow Extension

此包将两条 Coding 固定路线实现为宿主侧状态机，将条件规则组织为实际 Pi 事件驱动的 Hooks。它不是把整个 Skill 换成一段更长的 system prompt，也不是 MCP Server 的 Pi 适配。

## 试用与安装

基线：Pi Coding Agent **1.5.2**、Node.js **24+**。使用 Pi 提供的 `typebox` 等宿主模块，不复制宿主依赖。仓库离线检查涵盖状态机、模拟事件、宿主声明类型及入口加载。真实会话、子代理及 Memory 端到端验收需要当前环境证据。

在目标项目中一次性加载本地包，无须修改用户配置：

```bash
pi -e /absolute/path/to/token-io-decoupling-for-pi
```

确认可信后，用户可自行登记为目标项目的本地 package：

```bash
pi install /absolute/path/to/token-io-decoupling-for-pi --local
```

上条命令会改变目标项目 `.pi/settings.json`。本地包不复制源码；扩展/Skill 修改后由用户 `/reload` 或开新会话。不要只复制 `index.ts`：它依赖同包代码、模块清单及 Hook 资源。旧 CLI 的 `skills install/update` 只安装 Skill，不安装此 Extension；MCP 配置/身份接入仍须分别核验。

## 启动与控制

默认不接管会话，不按自然语言关键词猜测模式。显式开始：

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

启动入口共用 `startup.ts` 单一固定顺序问题注册表：**模式/预算 → 审计可见性**。有效显式字段不重问。审计菜单可选择使用默认或定制三个字段；默认值为 `audit_mode=balanced`、`root_reasoning_cadence=milestone_only`、`worker_reasoning_cadence=full`，逐字段记录 `explicit/default` 来源。默认预设只填缺失字段。取消、未回复或无效值不隐式默认；答案未齐不创建 Workflow、不执行工具。`/coding cancel` 取消正在收集的启动，Session/树导航使迟到答案失效，并发启动拒绝而不重复创建。

同一 Session 已确认答案跨完成后新任务、树导航、reload/resume 保留，不重复提问或回收预算；fork/new Session 重新收集。审计偏好进入状态、context、status 和子任务 bundle，只控制安全摘要策略，不证明完整日志访问、不披露私有思维链、不改变权限或独立验证。

- `single` 对应 `child_count=0`；`multi` 未填数量时为1。选择模式、预算或 task 不代表授权写入、Memory、联网或实际创建代理。
- 同 Session 锁定模式/数量；此版不提供会话内切换模式。新模式使用新 Session，不通过重启任务重置名额。
- 名额用尽后，仅用户明确 `/coding add-slot Change Verification` 等完整、不同职责名时增加一个；已绑定角色不能重复，终态不释放预算。
- `resume` 先唤醒 Agent 读回暂停点和实际效果，再结构化恢复；不会自动重放命令。`off` 是用户明确退出协调器，不是安全沙箱开关，不能据此宣称原任务已完成。

非交互/print/RPC 可在真实用户 prompt 前显式选择：

```bash
pi -e /absolute/path/to/token-io-decoupling-for-pi \
  --coding-mode single --coding-audit-defaults -p '在授权范围内完成任务，先核验约束'
```

非 UI 必须显式提交模式及审计答案，缺失时清晰阻断；不能让模型代选。`--coding-count 2` 用于 multi。审计显式 flags 为 `--coding-audit-mode economy|balanced|full`、`--coding-root-cadence full|milestone_only|off`、`--coding-worker-cadence full|milestone_only|off`；`--coding-audit-defaults` 明确接受未提供字段的默认值。命令入口在任务前使用去掉 `coding-` 前缀的参数，例如 `/coding multi 2 --audit-mode full --audit-defaults 任务` 或 `/coding start --mode single --audit-defaults 任务`。任务以 `--` 开头时用独立 `--` 分隔。`--coding-volatile` 不额外追加扩展状态，但 Pi 自身会话日志需另用其 `--no-session` 等设置管理；volatile 仅保留当前进程内答案/预算，扩展重载或跨进程 resume 无恢复证据时须新 Session，不依赖日志伪称可恢复，不得将丢失状态当作空预算继续。默认状态只追加到实际 Pi Session，不另建数据库、不写 Serena Memory。

## 工作流路线与工具

两条路线共享七模块：入口就绪 → Session 就绪 → 工作定义 → 执行 → 验证/修复 → 文档 → 交付/验收。执行模块分别为 single-execution 与 delegated-execution。检查点 ID 和指令取自 Layer-04，模块形状变化时要求同步审阅引擎。

多代理路线在 `DE02` 引用实际证据并明确 `facts.executor`。选择 `root` 时，一条记录覆盖职责预留、创建和派发（`DE03 / DE05 / DE06`）的 `not_applicable`，仍须经过 `DE04` 放行 Slice 和 `DE07` 审阅结果。选择 `sub_agent` 时，依次确认职责、当前 Slice 和创建前置条件，`DE06` 才可派发。Slice 替换、审批前置复核或相关 epoch 变化后，旧派发核验不能复用。需要重新核对执行者或派发条件时，上报 `executor_changed` 返回 `DE02`，保留已占名额和实际效果，先读回待处理结果。

| 工具 | 可执行内容 |
| --- | --- |
| `coding_checkpoint` | 查询当前状态、证据及规则片段。按 revision 提交同模块连续结果、上报语义信号、暂停、原位恢复、读回处置未知效果或读取大结果分页。 |
| `coding_slice` | 放行 Objective、精确路径及影响、Return conditions、Unreleased boundary，引用当前实际证据。 |
| `coding_run` | 经 `ctx.executeTool` 的真实宿主校验/权限/Hooks 调用不透明工具，声明 read/check/content/documentation/git/memory；不自行实现 Shell/MCP 旁路。 |
| `coding_delegate` | 在预算、职责、任务与 Slice 门禁后，调用实际暴露且 Schema 匹配的一次性单任务扩展。 |

每次模型请求注入适用 Hook 合同、当前检查点完整指令、后续适用项的标题以及最近 24 项观察。对 `coding-rule:文档#片段`，用 `coding_checkpoint` 的 `action=rules` 传入对应 `document` 和 `fragment`，每次读取一个片段。省略 `fragment` 时列出片段标题，省略 `document` 时定位当前模块。批量上报前逐项读过指令，并引用实际证据。批次限于同一模块。整个上下文包的硬上限为 96,000 字符，超限时停止并保留完整合同。

必需的 `facts` 包括 ER01 的 independence、WD03 的 plan=persisted/prohibited、DE02 的 executor=root/sub_agent、VR03 的 verification=passed、DA03 的 acceptance=satisfied 以及适用时 DA04 的 plan=archived。Agent 须为这些语义声明提供证据。WD03 引用真实 Memory 操作或明确禁止持久化的来源。

## 事件与语义信号

完整路由见 [Hooks 目录](hooks/README.md)。区分三类：

1. **真实事件**：`context`、`tool_call`、`tool_execution_end`、`session_start`、`session_tree`、`session_compact`、`input`、`user_bash`、`agent_before_settle`、`agent_settled`。
2. **流程条件**：进入当前模块/检查点、存在未知效果或预算已占用。
3. **语义信号**包括 `requirements_changed`、`decision_required`、`executor_changed`、`repair_required`、`documentation_impact`、`git_changed`、`context_exchange`、`advice_requested`、`materialization_requested` 和 `capability_changed`。Agent 依据直接证据识别并上报。

内置 edit/write 按真实调用路径守卫并更新 epoch；失败也可能部分写入，保守失效。Bash/codemode/MCP 影响由调用者显式声明；readOnlyHint 不是无副作用证明，不据它跳过不透明工具分类。外部进程、其他插件内未经过宿主事件链的操作不能自动观测。

文档变化经 Verification 后恢复 DOC04，Git 变化在 Acceptance 之前重验并恢复 DA03。决策补证根据调用方位置执行 WD01–WD03 中适用的检查，完成后回到原检查点。报告批次止于返回位置。DA04 已归档后，DA05 的决策补证至 WD02 即返回，保留已归档状态。能力变化在原位置重核适用条件。VR06 对照 VR03 的实际检查 epoch，状态变化时回 VR01 捕获并检查当前状态。修复保留外层 continuation。新用户输入、压缩、恢复、树导航或 abort 先撤销 Slice 并读回。当前分支的进度与整个 Session 的预算分开恢复，宿主文件效果须按当前状态核对。

只在最终可行动边界 `agent_before_settle` 请求续跑；不在 `agent_end` 自建循环。无检查点进展只提示一次，每次用户启动/继续预算最多8次；缺授权、证据或能力则 pause/blocked，不自动补授权。

## 多代理支持边界

- Pi 不内置子代理。本适配器按实际暴露、可调用的 Schema 区分旧版字符串 `agent`/`task`/`cwd` 与 `@mjakl/pi-subagent@3.1.0` 的 `calls[]`。新版每个 job 生成一次 `calls: [{agent, prompt, cwd, initialContext: "empty"}]` 宿主调用，不传 `session`。未知形状、额外必需字段或不能表达空上下文的接口在预留前拒绝。必须先发现工具和配置名，不按产品名猜 Schema。
- DE05 只核验，DE06 一次调用完成创建/派发/执行/返回，DE07 审阅正文；没有持久 ID 不阻断一次性完成，也不伪造 wait/resume。VR02 可在独立职责与容量齐备时调用只读 verifier。
- 多任务只对独立、无共享写入冲突的任务并行；不以终态回收预算。Root 必须向 task 提供准确来源、计划/Memory 名称、贡献范围及必要限制，不能把前置判断交给 worker。
- 此版没有持久子会话复用、任意异步扩展、Git 专用子代理或 OS/进程级隔离适配器；需要这些能力的分支明确阻断。外部 worker 的工具链是否继承限制须单独核验，提示词不是沙箱。
- 大结果可分页读取，不能只接受状态/摘要。分页缓存仅当前进程；重载后需从真实来源读回，不能重派任务来恢复丢失结果。

### 角色描述与按任务选型

仓库 `agents/*.md` 为中文描述源：worker对应Primary Output，reviewer对应Change Verification，scout对应Context Bootstrap/Refresh；planner保留名称但不产生第五职责，在Coding仅可作获准中性Context整理的别名，Root前置决策/计划不能外包。git-operator描述第四职责及阻断条件，不代表本适配器支持Git委派。

这些描述不固定model，已部署用户目录时由Root按[三模型卡参考](references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md#子代理模型与推理强度参考)为具体任务选择。旧增强版subagent支持顶层及parallel/chain每项 `model: "provider/id:thinking"`；3.1.0则使用calls[]每项独立的model与thinking。协调器将显式选择拆为 `model: "provider/id"` 和 `thinking`，调用档位覆盖代理配置及启动默认值；不改Root。选型与对应Schema能力在任何任务预留/执行前核验，不支持时拒绝，不钳制/回退。

通过本协调器派发时，`coding_delegate.jobs[]` 可提供 `model` 与简短 `modelReason`。有显式选择而目标Schema不支持对应model/thinking字段或档位时，在预留前拒绝，不降级为仅在任务正文里写模型名；省略时不补model/thinking字段，保留目标工具的真实默认/继承行为，Root须如实记录能力限制。modelReason只是Root依据，不证明选型充分。精确模型/档位由宿主调用记录核验，不要求Worker自报。

源描述和宿主适配补丁、模型卡核对记录位于仓库 `agents/`、`integrations/pi-subagent/`。加载本package不自动覆盖用户代理/安装补丁；部署属于单独明确授权的用户级文件修改，更新后需用户 `/reload` 或新会话，重新发现Schema。不能把磁盘变化当作当前会话已生效。

## 规则迁移边界

运行中的 Coding 路线、模块和已迁移的 Epoch 规则以 YAML DSL 为权威来源。编译器从 DSL 生成运行时片段，并从 16 份 Hook 合同生成可注入正文。扩展按需读取这些资源。Markdown 导出用于阅读或手动回退，来源和归属由 [逐篇来源整合对照](hooks/SOURCE_COVERAGE.md) 的离线检查核验。规则摘要和路径覆盖只能帮助核对版本及归属，细节冲突以 owner 及更高优先级规则为准。

引擎约束顺序、字段、已观察引用、预算、路径与 epoch。它不证明用户授权、检查输出正确、独立性、N/A 理由、内容保全或验收真的满足；不透明工具的 effect 也是声明。它不是恶意代码沙箱或 OS ACL。真实出站、Git、Memory 权限仍按原规则独立核验。

安装扩展后，分别核验 MCP 的实际工具注册、可信调用方绑定和操作授权。

## 离线验证

在仓库根目录：

```bash
npm test
npm run check:hooks
# 仅在修改逐篇来源表后，显式更新对照并审阅：
node scripts/check-pi-hooks.mjs --write-coverage
npm run check:types -- /absolute/path/to/installed/pi-coding-agent
npm run check:load -- /absolute/path/to/installed/pi-coding-agent
# 显式加载已有3.1.0的真实Schema/纯参数函数，不执行插件工具或启动子进程：
npm run check:subagent-contract -- /absolute/path/to/installed/pi-coding-agent /absolute/path/to/@mjakl/pi-subagent/index.ts
```

宿主类型/加载检查复用已有 Pi/TypeBox/Jiti 和已有 `tsc`；3.1.0契约检查使用真实注册Schema验证适配参数，并核对参数规范化、模型/thinking CLI和失败Hook。不下载依赖、不开 Pi 会话、不连接 MCP、不请求模型、不修改全局配置。也可用 `PI_EXTENSION_HOST_ROOT` 指定包根，`TSC_BIN` 指定已有编译器。真实客户端、实际子代理、Memory 后端及 API 端到端验收仍需独立环境与授权。
