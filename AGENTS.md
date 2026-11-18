# 仓库指令

## 项目范围与权威资料

- 本仓库维护面向 Pi Coding Agent 的 Extension、Skill 指令和通用 MCP 工具。以根目录 `README.md` 为项目入口；不要把 MCP 服务误当作宿主工作流引擎。
- Skill 指令维护在 `docs/rules/`。执行 `npm run build:skill` 生成 `docs/skill/`，生成目录由 Git 忽略。修改入口、Hook、工作流或策略时，先定位各自的 owner，保持职责边界。
- 文档维护规范见 [`docs/project/DOCUMENTATION_STANDARDS.md`](docs/project/DOCUMENTATION_STANDARDS.md)。MCP 专属约束见 [`mcp/AGENTS.md`](mcp/AGENTS.md)；MCP 构建、测试和工具契约见 [`docs/project/mcp/DEVELOPMENT.md`](docs/project/mcp/DEVELOPMENT.md)。

## 修改与验证

- 维护中的文档使用简体中文和现有文件名；不新增英文副本或旧式语言后缀镜像。本地 Markdown 链接须指向存在的当前文件，移动或重命名时同步更新引用。
- 修改按需验证，不把结构检查当作语义验收。Extension 有关改动使用 `package.json` 中适用的 `npm test` 和检查脚本；文档变更按文档规范运行对应检查。
- MCP 普通测试不应调用真实模型或 API。MCP 的测试、lint 和构建命令以 MCP 开发指南为准；真实 API 测试仅在明确需要且具备相应授权时运行。

## 安全与 Git

- 保留可信身份绑定、授权、路径校验和外发检查；工具可用或配置存在不等于获得授权。不得输出凭据或将未核实的会话/请求元数据当作身份。
- 保留无关工作区内容和未跟踪文件；只暂存当前任务明确涉及的路径。提交、推送及其他 Git 副作用须有明确授权，不绕过正常检查或 hooks。
