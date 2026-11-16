# Token I/O Decoupling


`token-io-decoupling` 是一个 Agent 调度 Skill，用于把高价值语义决策与高体量状态消费、输出物化分离。

它维护面向 **Pi Coding Agent** 仓库和开发工作的 **Coding** 工作流。Multimodal 内容仅作为独立 reference 保留，不作为可执行工作流维护。请从 [Skill 入口](docs/skill/SKILL.md) 开始；它会按任务当前阶段路由到所需的 reference。

## 独立安装 Skill

将开发仓库放在用户 Skill 目录之外。安装构建后的 CLI（参见 MCP 安装指南）后运行：

```bash
token-io-decoupling skills install
token-io-decoupling skills update
```

默认安装到 `~/.agents/skills/token-io-decoupling-skill`；可用 `--name NEW-NAME` 指定另一个小写、连字符分隔的名称。旧名称 `token-io-decoupling` 始终被拒绝。安装器不会修改或删除旧项目，会拒绝符号链接路径及已有未知目录，只更新内容未经修改且由本工具管理的安装。更新前请将本地修改另行保存。发布失败时会恢复旧安装；进程中断可能遗留锁或暂存目录，应先检查再人工恢复。

Skill 指令源位于 [docs/skill](docs/skill/SKILL.md)。wheel 和源码分发包携带独立快照，包含中文工作流、引用以及支持文档和脚本。安装只读取该快照，不读取或克隆源码仓库；开发改动必须重新构建、安装 CLI 并显式更新 Skill 后才生效。安装后的 `_project/` 是生成的支持资料快照，不是新的源文档 owner。本轮只更新指令，MCP 注册与身份接入尚未迁移，不能据此宣称已支持 Pi。

兼容旧安装时，请在请求中使用新 Skill 名称。已有会话可能保留旧指令：保留并迁移旧开发仓库后，使用现有配置人工停用其旧 Skill 发现入口，再启动使用新名称的新会话。安装器不删除旧项目，也不自动处理重复发现。不要再次将开发仓库本身放进 Skill 目录。

## Pi 使用与 MCP 迁移边界

从 Skill 入口渐进加载当前步骤的 owner。Pi 原生提供基础文件与命令工具；子代理、专用规划及 Memory 依实际暴露的扩展或服务核验，不假定内置。修改 Skill 后由用户 `/reload` 或新建会话；磁盘更新不自动替换当前已加载指令。

本轮不修改 `mcp/`、服务安装器或调用方身份协议，暂不提供未经实现与验证的 Pi 安装命令。可选导航/建议不适用时直接依据 owner 判断；必需的 Memory、身份或受保护写入能力缺失时暂停依赖工作。服务内部仍通过 OpenAI API 执行，原有授权、角色、路径与安全守卫继续有效。

## 文档入口

- [Skill 入口](docs/skill/SKILL.md)：主要路由入口。
- [Coding reference](docs/skill/references)：由工作流组合使用的独立 Coding 模块和共享协议模块。
- [工作流架构](docs/skill/WORKFLOW_ARCHITECTURE.md)：无状态规则导航与结构检查，以及单独守卫的可选输出物化能力。
- [MCP 开发指南](mcp/DEVELOPMENT.md)：本地 Python 检查与包构建。

无状态规则与工作流路径无需数据库、API 凭据或网络请求。可选语义建议默认关闭；每次真实 API 请求都必须读取本地 `OPENAI_API_KEY` 与 `OPENAI_BASE_URL`，缺失时不得请求。显式启用与测试方法见开发指南。公共接口包括本地 Memory 读取、任务计划生命周期、合规预检、路由及无状态上下文/选择工具。发现工具不证明能力或授权。未配置可信启动注入式授权 provider 和独立 grant 时，可选输出物化仍不可用。

OpenAI API 工具共用显式设置 `trust_env=True` 的 HTTPX2 客户端，从 MCP 进程环境读取 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 和 `NO_PROXY`，包括对应的小写形式。`NO_PROXY` 可使指定目标绕过代理；未配置代理时使用客户端正常的直连路径。代理无效或不可达时返回现有的安全 API 错误结果，不会改为直连重试。

Pi 的 MCP 进程环境按实际宿主配置传递；不要套用其他宿主字段，也不要记录凭据值。连接、工具发现、API 配置和可信身份绑定分别核验；转发环境不启用 Decisions，也不授予操作权限。
