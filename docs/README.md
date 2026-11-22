# 项目文档

本项目为 Pi Coding Agent 提供 Coding Skill 和独立的 MCP 通用工具。规则源在 `rules/`，生成的阅读版在 `skill/`；`docs/` 只维护项目文档。Multimodal 仅作参考，不提供独立路线。

## 使用与架构

- [安装与更新](../INSTALL.md)：安装 Skill 和 MCP 工具，并配置 Pi。
- [Skill 入口](../skill/SKILL.md)与 [Coding 选择器](../skill/workflows/coding.md)：按所选路线读取适用 Hook。
- [工作流架构](WORKFLOW_ARCHITECTURE.md)：Skill、Pi 宿主和 MCP 的职责与归档边界。

## 维护与验证

- [文档标准与维护规范](DOCUMENTATION_STANDARDS.md)：目录职责、DSL、模板与检查。
- [TypeScript / JavaScript 代码规范](TS_JS_CODE_SPECIFICATION.md#静态代码检查)：代码规则、静态检查与审查要求。
- [外部参考资料](EXTERNAL_REFERENCES.md)：维护现行能力时所用的上游资料。
- [工作流迁移记录与校验清单](migrations/WORKFLOW_MODULE_MIGRATION.md)：开发验证资料，不是运行时指令。

## MCP

- [开发指南](mcp/DEVELOPMENT.md)：注册、可信调用方、包结构和测试。
- [候选内容合规预检](mcp/CANDIDATE_COMPLIANCE.md)：只读候选覆盖层检查。
- [输出材料化](mcp/OUTPUT_MATERIALIZATION.md)：受保护的 Worker 输出准备、检查和写入。
- [Serena Memory 工具](mcp/SERENA_MEMORY_TOOLS.md)：只读尾部读取和字面匹配。
