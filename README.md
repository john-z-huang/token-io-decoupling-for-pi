# Token I/O Decoupling

面向 Pi Coding Agent 的 Coding Hooks Skill。两条路线由 YAML 定义，16 份条件 Hook 约定执行时机、所需证据和验收条件。Agent 按当前任务读取适用指令。Multimodal 仅作为参考。

按[安装与更新](INSTALL.md)中的命令生成并更新本地 Skill。使用时从 `SKILL.md` 进入，按当前路线和适用 Hook 读取规则。磁盘更新后，在 Pi 中执行 `/reload` 或新开会话。

- [Skill 源入口](rules/SKILL.yaml)和 [Hooks 源目录](rules/hooks/README.yaml)
- [工作流架构](docs/WORKFLOW_ARCHITECTURE.md)和[维护规范](docs/DOCUMENTATION_STANDARDS.md)
- [子代理职责描述](agents/)
- [旧 MCP Server 归档](archive/mcp-server/)

Pi 中的通用 MCP 工具由单独配置的服务提供。项目 Memory 尾部读取和文本核验由 `dev-workflow-standards` 提供，使用前核对 MCP 进程实际启动的项目根。
