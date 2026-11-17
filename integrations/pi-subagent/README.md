# 现有Pi子代理适配

## 范围与单源

当前适配基线为 Pi Coding Agent 1.5.2 与 `@mjakl/pi-subagent@3.1.0`。本页也保留旧subagent示例扩展的补丁/部署记录；该补丁仅适用于已记录的旧文件哈希，不适用于3.1.0。仓库 `agents/*.md` 为中文描述权威源，`~/.pi/agent/agents/` 是部署副本，不是双语镜像或独立规则owner。职责权威仍是 [Session职责归属](../../docs/skill/references/coding/layer-01-fundamental-concepts/session-runtime/session-role-ownership.md)。角色、配置名称、模型是三个独立维度。

| 现有名称 | Coding职责/边界 |
| --- | --- |
| worker | Primary Output：获准代码/配置或Skill文档，不能接管Root前置判断/验收 |
| reviewer | Change Verification：真正独立、当前epoch证据；产品实现只读，不修复 |
| scout | Context Bootstrap/Refresh：中性事实、来源/策略路由与freshness，不定义/实现/验证任务 |
| planner | 保留通用只读候选分析；Coding不设规划子职责，只有合法Context allocation可借用其事实整理能力 |
| git-operator（新增描述） | Documentation/Comments & Git Operations：仅获准非简单Git；当前coding_delegate仍拒绝，无专用能力时阻断，普通文档由Root |

所有描述去掉原 `openai/gpt-6-luna:low` 固定值。Root按[模型卡与参考档位](../../docs/skill/references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md#子代理模型与推理强度参考)自主选择，不按角色绑定；[model-cards.json](model-cards.json)保存公共文档获取时间、URL、摘要和原文SHA-256，非性能测试。没有请求真实模型API，MCP内部固定模型不变。

## 当前3.1.0接口适配

3.1.0原生支持 `calls[]`，每项使用 `agent`、`prompt` 及可选 `cwd`、`model`、`thinking`、`initialContext`、`session`，不需要旧版model补丁。本仓库 [纯Schema适配器](../../extensions/coding-workflow/subagent-adapter.ts) 依据实际工具Schema区分新旧接口，不按包名或工具名猜能力。

`coding_delegate` 外部参数不变：每个job仍使用task及可选 `model: "provider/id:thinking"`、modelReason。新版映射为单项calls数组：task转prompt、上下文固定empty、不传session；显式选型拆成model与thinking，防止代理默认thinking覆盖Root选择。未显式选型则两字段均省略，保留插件真实默认/继承行为。所有job在预算预留与执行前核验对应字段和档位；未知Schema或额外必需字段拒绝，不静默回退。

执行仍通过 `ctx.executeTool`，保留宿主权限、Hooks及插件根据details.failed设置isError的结果处理；不直接调用runner启动子进程。每个job各有一次真实宿主调用，独立任务可按既有门禁并行，终态不返还职责预算。此适配不实现命名会话复用，也不把插件“session不存在则创建”的能力当作严格仅续接；Git专用、身份与OS隔离边界不变。

只更新仓库代码不代表当前会话已加载，需用户重新加载本package或新会话；不自动修改用户插件、代理、认证、models、settings或MCP配置。部署旧补丁与加载新适配器是两件事。

## 旧示例扩展：宿主补丁（不适用于3.1.0）

未增强示例仅支持agent/task/cwd，模型来自agent frontmatter或父级。task里写“用Sol/high”不会改变子进程设置。本仓库 [model-override.patch](model-override.patch) 对现有index.ts作最小增量，并使用 [纯选型助手](../../extensions/coding-workflow/model-selection.ts)：

- 单任务顶层、parallel/chain每项均可传 `model: "provider/model:thinking"`，每项优先于顶层，显式请求优先于agent固定值，最后才继承父级。
- 显式选择须精确且当前可用、档位受支持；全部任务启动前校验（含后续chain步骤）。不会静默换模型/钳制。无选择保持原有继承行为，不改父级或全局模型默认值。
- 配置意图存为requestedModel，结果model来自宿主assistant消息元数据，不再预填请求值冒充实际返回。不要求子代理自查/自报，也不把元数据声称为服务端受保护身份证明。
- 授权、工具/路径、项目代理确认、职责预算、未知效果和完整结果审阅边界不变。真实PI可达性、provider配置、API兼容性仍须核验。

同时将原agentScope的StringEnum改为TypeBox字面量union以匹配本机宿主类型，枚举值与默认user不变。

补丁使用零行上下文的标准统一差异格式，应用和反向核验均需 `git apply --unidiff-zero`；必须先校验下面的基线SHA-256，再审阅全部增删，不可对未知版本强制应用。

补丁基线index.ts SHA-256：`8e2c30b593f165a2df0f42686c596d793af6265adeeeac628176ec70fc7c6424`。未来上游/本地文件不同必须重新审阅，不能覆盖或强制套用。它不是复制一整份宿主扩展，也不修改Homebrew安装目录。

## 旧示例扩展：部署与调用记录

此前旧示例适配阶段，在用户明确授权后更新过本机五份代理描述、旧subagent/index.ts及其同目录model-selection.ts；当时未动auth/models/settings/MCP配置。本次3.1.0接口修复没有修改这些用户级文件。package加载不自动进行这些用户级写入。后续部署前先核对现有文件/符号链接、本地改动与授权；仅对上述匹配基线使用补丁并审阅diff，将纯助手复制到subagent同目录，将获准的agents源复制到用户agents目录。不对未知内容批量覆盖。

需要用户在任务结束后 `/reload` 或新会话，重新发现当前真实工具Schema。省略model只是继承，不代表Root完成了按任务选型。

创建前 Root 必须先按[端点继承 owner](../../docs/skill/references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md#子代理端点跟随-root)确认当前有效 provider、模型 ID 及可见 API/端点路由元数据与来源，再在同端点选型。`openai-codex` 不得改成 `openai`，`openai` API 也不得改走 `openai-codex`；角色固定值和默认继承不能替代此核验。此补丁提供显式选型能力，不自动验证 Root/子代理端点一致；Root 必须核验实际路由，不能保证时停止创建，不跨端点回退。

以下增强版示例仅适用于已确认 Root 当前使用 `openai` 且该模型/档位可用的情形（是工具参数，不是Shell命令；仍需模式/预算/Slice等授权）；Root 使用 `openai-codex` 时须改用该 provider 下已核验可用的精确模型 ID，不能照抄：

```json
{
  "agent": "worker",
  "task": "<已放行的精确任务、Contract、来源与返回条件>",
  "model": "openai/gpt-6.1-sol:medium"
}
```

parallel/chain每项可独立选型，不能用链式调用冒充同一身份复用。本项目协调器用 `coding_delegate.jobs[].model` 与 `modelReason` 转交；Git专用/持久异步适配仍未实现，不能直接调用subagent绕过拒绝。

## 离线核验

```bash
npm test
npm run check:hooks
npm run check:types -- /absolute/path/to/installed/pi-coding-agent
npm run check:load -- /absolute/path/to/installed/pi-coding-agent
npm run check:subagents -- /absolute/path/to/installed/pi-coding-agent /absolute/path/to/agent/extensions/subagent/index.ts
```

上面的 `check:subagents` 专用于旧示例补丁和部署副本，不接受3.1.0作为同一基线。它在隔离校验进程中加载已有宿主模块、核对部署副本/Schema，用模拟spawn记录CLI参数；不启动真实Pi子进程、不调用模型/Memory后端、不改全局配置。

对3.1.0使用独立契约检查：

```bash
npm run check:subagent-contract -- /absolute/path/to/installed/pi-coding-agent /absolute/path/to/@mjakl/pi-subagent/index.ts
```

该检查仅加载已有3.1.0的真实注册Schema/纯参数函数，用宿主TypeBox校验生成参数，覆盖prompt、空上下文、无命名Session、模型/thinking CLI及失败Hook；不执行插件工具、不触发agent发现、不启动Pi子进程、不联网或修改配置。其他版本需重新审阅契约。两类离线检查都不能替代真实客户端、provider和模型后端端到端验收。
