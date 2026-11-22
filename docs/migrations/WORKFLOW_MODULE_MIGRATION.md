# 工作流迁移与校验资料

本文只供维护者理解迁移边界，不是运行时路线或授权来源。详细的旧步骤及职责表可从 Git 历史版本查阅；当前行为以 [路线目录](../../rules/workflows/README.yaml)、[Hook 合同](../../rules/hooks/README.yaml)和对应的参考规则为准。

- 两条 Coding 路线保留七个主阶段及阶段间顺序，阶段检查点和通过条件由对应 Hook 维护；Layer-03 负责当次任务的判断，不重新定义 Layer-01/02 政策。
- 触发补证、修复或验证失效时，依据当前合同返回受影响的检查点，不按历史编号继续，也不重放已完成的效果。

## 构建与测试仍使用的清单

| 清单 | 用途 |
| --- | --- |
| [Coding 文档迁移清单](coding-document-migration.json) | `scripts/check_coding_document_migration.py` 核对 Markdown owner 迁移后的目标、退役状态及 README 导航。 |
| [工作流模块迁移清单](workflow-module-migration.json) | `scripts/check-layer-04-workflow-maps.py` 核对旧步骤投影、当前路线与 Hook 检查点及 owner 链接。 |

历史优化测量留在 `mcp/benchmarks/`，不提供当前运行入口，也不代表现行 MCP 的性能或能力。
