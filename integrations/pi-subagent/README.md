# Pi 子代理适配

## 范围与单源

当前适配基线为 Pi Coding Agent 1.5.2 与 `@mjakl/pi-subagent@3.1.0`。仓库 `agents/*.md` 为中文描述权威源，`~/.pi/agent/agents/` 是部署副本，不是双语镜像或独立规则owner。职责权威仍是 [Session职责归属](../../docs/skill/references/coding/layer-01-fundamental-concepts/session-runtime/session-role-ownership.md)。角色、配置名称、模型是三个独立维度。

| 现有名称 | Coding职责/边界 |
| --- | --- |
| worker | Primary Output：获准代码/配置或Skill文档，不能接管Root前置判断/验收 |
| reviewer | Change Verification：真正独立、当前epoch证据；产品实现只读，不修复 |
| scout | Context Bootstrap/Refresh：中性事实、来源/策略路由与freshness，不定义/实现/验证任务 |
| planner | 保留通用只读候选分析；Coding不设规划子职责，只有合法Context allocation可借用其事实整理能力 |
| git-operator（新增描述） | Documentation/Comments & Git Operations：仅获准非简单Git；当前coding_delegate仍拒绝，无专用能力时阻断，普通文档由Root |

所有描述去掉原 `openai/gpt-6-luna:low` 固定值。Root按[模型卡与参考档位](../../docs/skill/references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md#子代理模型与推理强度参考)自主选择，不按角色绑定；[model-cards.json](model-cards.json)保存公共文档获取时间、URL、摘要和原文SHA-256，非性能测试。没有请求真实模型API，MCP内部固定模型不变。

## 3.1.0 接口适配

3.1.0原生支持 `calls[]`，每项使用 `agent`、`prompt` 及可选 `cwd`、`model`、`thinking`、`initialContext`、`session`。本仓库 [纯Schema适配器](../../extensions/coding-workflow/subagent-adapter.ts) 在派发前检查宿主实际注册的 `calls[]` Schema。

`coding_delegate` 外部参数不变：每个job仍使用task及可选 `model: "provider/id:thinking"`、modelReason。适配器映射为单项 `calls[]`：task转prompt、上下文固定empty、不传session；显式选型拆成model与thinking，防止代理默认thinking覆盖Root选择。未显式选型则两字段均省略，保留插件真实默认/继承行为。所有job在预算预留与执行前核验对应字段和档位；未知Schema或额外必需字段拒绝，不静默回退。

执行仍通过 `ctx.executeTool`，保留宿主权限、Hooks及插件根据details.failed设置isError的结果处理；不直接调用runner启动子进程。每个job各有一次真实宿主调用，独立任务可按既有门禁并行，终态不返还职责预算。此适配不实现命名会话复用，也不把插件“session不存在则创建”的能力当作严格仅续接；Git专用、身份与OS隔离边界不变。

只更新仓库代码不代表当前会话已加载，需用户重新加载本package或新会话；不自动修改用户插件、代理、认证、models、settings或MCP配置。

创建前，Root 按端点继承规则核验当前 provider、模型 ID 及 API 路由，并为子代理选择同端点的模型与推理档位。实际能力不足时暂停该次委派。 [端点继承规则](../../docs/skill/references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md#子代理端点跟随-root)

## 离线核验

```bash
npm test
npm run check:hooks
npm run check:types -- /absolute/path/to/installed/pi-coding-agent
npm run check:load -- /absolute/path/to/installed/pi-coding-agent
```

用本机安装的 3.1.0 核对契约。

```bash
npm run check:subagent-contract -- /absolute/path/to/installed/pi-coding-agent /absolute/path/to/@mjakl/pi-subagent/index.ts
```

该检查仅加载已有3.1.0的真实注册Schema/纯参数函数，用宿主TypeBox校验生成参数，覆盖prompt、空上下文、无命名Session、模型/thinking CLI及失败Hook；不执行插件工具、不触发agent发现、不启动Pi子进程、不联网或修改配置。其他版本需重新审阅契约。真实客户端、provider 和模型后端另行做端到端验收。
