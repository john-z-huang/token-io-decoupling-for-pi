# 项目文档

`docs/` 仅存放项目文档，包括维护规范、MCP 开发参考和迁移记录。[规则源](../rules/SKILL.yaml)位于仓库根目录的 `rules/`，经编译生成同级的 `skill/`，当前包只声明 `pi.skills`；Agent 通过 Skill 按路线与适用 Hook 工作。

## 项目级参考

- [文档标准与维护规范](DOCUMENTATION_STANDARDS.md)
- [TypeScript / JavaScript 代码规范](TS_JS_CODE_SPECIFICATION.md)
- [静态代码检查](STATIC_CODE_CHECKS.md)
- [旧 Pi Extension 历史说明](PI_EXTENSION.md)
- [工作流架构](WORKFLOW_ARCHITECTURE.md)
- [外部资料引用登记](EXTERNAL_REFERENCES.md)

## MCP 开发参考

- [MCP 开发指南](mcp/DEVELOPMENT.md)
- [调用方上下文与受保护能力](mcp/CALLER_CONTEXT.md)
- [候选内容合规预检](mcp/CANDIDATE_COMPLIANCE.md)
- [输出材料化](mcp/OUTPUT_MATERIALIZATION.md)
- [工具注册](mcp/TOOLS_REGISTRATION.md)
- [Serena Memory 工具](mcp/SERENA_MEMORY_TOOLS.md)
- [任务计划工具与历史边界](mcp/TASK_PLAN_TOOLS.md)
- [工作流路由历史说明](mcp/WORKFLOW_ROUTING.md)
- [优化基准归档说明](mcp/OPTIMIZATION_BENCHMARK.md)
- [MCP 目录指令（保留在源码目录）](../mcp/AGENTS.md)

## 迁移记录

- [工作流模块迁移覆盖](migrations/WORKFLOW_MODULE_MIGRATION.md)
- [Coding 工作流职责迁移记录](migrations/coding-workflow-responsibility-migration.md)
- [Coding 文档迁移清单](migrations/coding-document-migration.json)
- [工作流模块迁移清单](migrations/workflow-module-migration.json)
