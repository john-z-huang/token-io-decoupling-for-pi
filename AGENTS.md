# 仓库指令

## 项目范围与权威资料

- 本仓库维护面向 Pi Coding Agent 的 Extension、Skill 指令和通用 MCP 工具。以根目录 `README.md` 为项目入口；不要把 MCP 服务误当作宿主工作流引擎。
- Skill 指令维护在 `rules/`。执行 `npm run build:skill` 生成 `skill/`，生成目录由 Git 忽略。`docs/` 只存放项目文档。修改入口、Hook、工作流或策略时，先定位各自的 owner，保持职责边界。
- 文档维护规范见 [`docs/DOCUMENTATION_STANDARDS.md`](docs/DOCUMENTATION_STANDARDS.md)。MCP 专属约束见 [`mcp/AGENTS.md`](mcp/AGENTS.md)；MCP 构建、测试和工具契约见 [`docs/mcp/DEVELOPMENT.md`](docs/mcp/DEVELOPMENT.md)。

## Coding 工作流方向

- 已归档的旧扩展是将 `rules/coding-workflows/` 的流程固化为代码的旧实验。过细的程序化约束降低了 Code Agent 的执行效率，也限制了模型已有的判断和执行能力。该实现已停止开发；归档仅供只读参考，不加载、不构建、不验证。Skill 与 MCP 入口保持独立；归档不表示旧 Hook 适配已迁移或完成运行时验收。
- 后续开发以 [Hook 合同](rules/hooks/README.yaml) 为主要规则源。[单代理路线](rules/coding-workflows/coding-single-agent.yaml)和[多代理路线](rules/coding-workflows/coding-multi-agent.yaml)只作为指令供 Agent 阅读和理解，不编码为状态机。Hook 合同不是逐条自动触发的 Pi 宿主事件。
- Code Agent 根据规则和已核实的事实，判断适用的 Hook、工具和分支，以及何时推进、复核或停下；必须遵守适用的 Hook 门禁和用户授权。

### 固定方法准入与调用

以下限制仅适用于本仓库未来 Coding 工作流扩展的固定方法，不适用于通用 MCP 工具。

- 只实现 Hook 必需的最小固定方法。新增前须指明对应的 Hook 条款、为何现有获准入口不足、最小输入和输出，以及回执能证明什么、不能证明什么。原生工具或现有受保护能力能满足要求时不再包装。
- 不按阶段或检查点逐个造接口，不复制政策，不维护路线游标或强制队列，不自动派发或推进。
- 仅供 Pi Agent 通过 Pi 原生 `model-only` 工具直调；不增加面向人的 CLI 或斜杠命令，不增加 MCP、codemode 或嵌套调用入口。`model-only` 不是 OS 安全隔离。
- 工具返回的事实、指纹和回执只在各自的证据边界内使用，不代替授权判定、独立验证或最终验收。

## 修改与验证

- 维护中的文档使用简体中文和现有文件名；不新增英文副本或旧式语言后缀镜像。本地 Markdown 链接须指向存在的当前文件，移动或重命名时同步更新引用。
- 修改按需验证，不把结构检查当作语义验收。归档扩展不参与当前验证；文档变更按文档规范运行对应检查。
- Coding 工作流扩展在完整测试与实际环境验证完成前不得推荐安装；不得把离线检查描述为完整测试、实际环境验收或运行效率的证明。
- JS、TS 和 MJS 遵循 [TypeScript / JavaScript 代码规范](docs/TS_JS_CODE_SPECIFICATION.md)。按 [静态代码检查](docs/STATIC_CODE_CHECKS.md) 执行 `npm run lint`，排版修复使用 `npm run lint:fix`。已覆盖条款采用命令结果，Code Agent 根据实际变更审查其余条款。
- MCP 普通测试不应调用真实模型或 API。MCP 的测试、lint 和构建命令以 MCP 开发指南为准；真实 API 测试仅在明确需要且具备相应授权时运行。

## 安全与 Git

- 保留可信身份绑定、授权、路径校验和外发检查；工具可用或配置存在不等于获得授权。不得输出凭据或将未核实的会话/请求元数据当作身份。
- 保留无关工作区内容和未跟踪文件；只暂存当前任务明确涉及的路径。提交、推送及其他 Git 副作用须有明确授权，不绕过正常检查或 hooks。
