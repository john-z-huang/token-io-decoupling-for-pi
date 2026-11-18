# Token I/O Decoupling


`token-io-decoupling` 是面向 **Pi Coding Agent** 的 Extension + Skill 包，用于把高价值语义决策与高体量状态消费、输出物化分离。

两条 Coding 路线由 YAML 绑定七个阶段。16 份条件 Hooks 提供执行合同，阶段 Hook 决定检查点顺序及适用性。Extension 负责宿主工具守卫、验证失效和暂停续接。授权和语义验收依据实际来源与结果核对。Multimodal 仅作为 reference 保留。

## Pi 工作流插件开发状态与验证

> **现阶段不建议在 Pi Coding Agent 中安装工作流插件（`extensions/coding-workflow/`）。** 该插件仍在开发，已有离线检查，完整测试和实际环境验证尚未完成。目前无法确认插件能否在 Pi Coding Agent 中高效运行。

开发者可在测试项目中临时加载插件进行验证。先在本仓库安装 YAML 解析依赖。`npm ci` 会通过 `prepare` 调用 `uv`，生成 `docs/skill/` 中的 Skill 阅读版。请先确保 `uv` 可用。

```bash
npm ci --legacy-peer-deps
```

然后在测试项目中运行以下命令，临时加载插件。

```bash
pi -e /absolute/path/to/token-io-decoupling-for-pi
```

然后由用户明确选择：

```text
/coding start 任务描述
/coding single 任务描述
/coding multi 任务描述
/coding multi 2 任务描述
```

默认不接管会话，也不创建子代理。启动固定先模式/预算后审计可见性；显式有效字段不重问，缺失字段须选择默认或定制，取消/未回复不隐式默认，未完成不创建 Workflow、不执行工具。非 UI 可用 `--coding-mode single --coding-audit-defaults` 明确提交；缺答案时阻断。答案与逐字段来源在同 Session 跨任务、树导航和 reload/resume 保留，fork/new Session 重新收集；volatile 仅进程内、不追加扩展记录、不假称可从日志恢复。模式/预算或审计偏好不证明完整日志能力，也不披露私有思维链。模式/预算选择不授予写入、Memory、网络或 Git 权限。四个协调工具、宿主事件、离线验证及适配器限制见 [Pi Extension 使用说明](docs/project/PI_EXTENSION.md#工作流路线与工具) 和 [Hooks 目录](docs/skill/hooks/README.md)。未启用 Extension 时从 [Skill 入口](docs/skill/SKILL.md) 走原有 owner 回退路线。

## 现有Pi子代理描述与Root选型

中文代理描述源在 [agents/](agents/)：worker、reviewer、scout分别适配Primary、独立验证、Context职责；planner保留只读兼容边界，git-operator仅提供受阻断的专用职责描述。模型不固定到角色：Root依据三份官方模型卡和当前任务，在Sol、Terra、Luna之间选择模型及推理水平。

当前 `@mjakl/pi-subagent` 3.1.0 的接口与逐任务模型选型见 [Pi 子代理适配](integrations/pi-subagent/README.md#310-接口适配)。加载本package不自动覆盖用户配置；本机部署与普通package加载是两件事，不能把描述文件存在当作Git专用适配器、权限隔离或模型身份能力已实现。

## 仅安装 Skill（不包含 Extension）

将开发仓库放在用户 Skill 目录之外。在仓库根目录运行 `bash scripts/install-pi-mcp.sh`，通过 uv tool 安装唯一工具程序，然后运行：

```bash
token-io-decoupling-tools skills install
token-io-decoupling-tools skills update
```

默认安装到 `~/.pi/agent/skills/token-io-decoupling-skill`；可用 `--name NEW-NAME` 指定另一个小写、连字符分隔的名称。旧名称 `token-io-decoupling` 始终被拒绝。安装器不会修改或删除旧项目，会拒绝符号链接路径及已有未知目录，只更新内容未经修改且由本工具管理的安装。更新前请将本地修改另行保存。发布失败时会恢复旧安装；进程中断可能遗留锁或暂存目录，应先检查再人工恢复。

Skill 从 [入口 YAML](docs/rules/SKILL.yaml) 和 `docs/rules/` 中的规则生成。编译后的入口位于 [docs/skill/SKILL.md](docs/skill/SKILL.md)，生成目录由 Git 忽略。Pi Extension 直接加载原始 YAML 并按片段 ID 查询。MCP 构建会生成独立快照，包含中文工作流、参考文档、支持文档和脚本。开发改动需重新构建、安装 CLI 并显式更新 Skill 后才生效。安装后的 `_project/` 是生成的支持资料快照。通过 CLI 安装 Skill 和通过 Pi 加载 Extension 分别执行。MCP 使用唯一 tools 程序，需按实际 Pi MCP 配置显式注册。受保护写入仍要求独立可信绑定。 [维护说明](docs/project/DOCUMENTATION_STANDARDS.md#参考规则-dsl)

兼容旧安装时，请在请求中使用新 Skill 名称。已有会话可能保留旧指令：保留并迁移旧开发仓库后，使用现有配置人工停用其旧 Skill 发现入口，再启动使用新名称的新会话。安装器不删除旧项目，也不自动处理重复发现。不要再次将开发仓库本身放进 Skill 目录。

## Pi 使用与 MCP 迁移边界

从 Skill 入口渐进加载当前步骤的 owner。Pi 原生提供基础文件与命令工具；子代理、专用规划及 Memory 依实际暴露的扩展或服务核验，不假定内置。修改 Skill 后由用户 `/reload` 或新建会话；磁盘更新不自动替换当前已加载指令。

MCP 已收敛为 `token-io-decoupling-tools`，需单独配置。上面的临时加载命令只加载宿主侧 Extension/Skill。可选导航/建议不适用时直接依据 owner 判断；必需的 Memory、身份或受保护写入能力缺失时暂停依赖工作。服务内部仍通过 OpenAI API 执行，原有授权、角色、路径与安全守卫继续有效。

## 文档入口

- [Pi Coding 工作流变更日志](CHANGELOG/CHANGELOG.md) 记录工作流路线、Extension 推进和模块演进。
- [代码质量工具与规范自动化变更日志](CHANGELOG/CODE_QUALITY.md) 记录 Lint、格式化和代码规范自动化。
- [Pi Extension](docs/project/PI_EXTENSION.md) 介绍开发试用、事件、Hook 推进、适配及验证边界。
- [静态代码检查](docs/project/STATIC_CODE_CHECKS.md) 说明 JS、TS 和 MJS 的自动化检查与 Code Agent 审查要求。
- [Hooks 目录](docs/skill/hooks/README.md)：明确触发条件与执行合同。
- [Skill 入口](docs/skill/SKILL.md)：轻量入口与未启用扩展的回退路线。
- [Coding reference](docs/skill/references)：由工作流组合使用的独立 Coding 模块和共享协议模块。
- [工作流架构](docs/project/WORKFLOW_ARCHITECTURE.md)：无状态规则导航与结构检查，以及单独守卫的可选输出物化能力。
- [项目文档索引](docs/project/README.md)：项目规范、MCP 参考和迁移记录。
- [MCP 开发指南](docs/project/mcp/DEVELOPMENT.md)：本地 Python 检查与包构建。

无状态规则与工作流路径无需数据库、API 凭据或网络请求。可选语义建议默认关闭；每次真实 API 请求都必须读取本地 `OPENAI_API_KEY` 与 `OPENAI_BASE_URL`，缺失时不得请求。显式启用与测试方法见开发指南。公共接口包括本地 Memory 读取、合规预检、规则上下文和通用开发工具；流程调度及任务计划生命周期不再由 MCP 提供。发现工具不证明能力或授权。未配置可信启动注入式授权 provider 和独立 grant 时，可选输出物化仍不可用。

OpenAI API 工具共用显式设置 `trust_env=True` 的 HTTPX2 客户端，从 MCP 进程环境读取 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 和 `NO_PROXY`，包括对应的小写形式。`NO_PROXY` 可使指定目标绕过代理；未配置代理时使用客户端正常的直连路径。代理无效或不可达时返回现有的安全 API 错误结果，不会改为直连重试。

Pi 的 MCP 进程环境按实际宿主配置传递；不要套用其他宿主字段，也不要记录凭据值。连接、工具发现、API 配置和可信身份绑定分别核验；转发环境不授予操作权限。
