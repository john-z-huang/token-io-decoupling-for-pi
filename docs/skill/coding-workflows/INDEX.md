# 完整路线索引

<!-- 由 docs/rules/coding-workflows/INDEX.yaml 生成。请在 DSL 中维护正文。 -->


- [单代理 Coding](coding-single-agent.md)
- [多代理 Coding](coding-multi-agent.md)

## 分阶段 Hooks

路线按序绑定这些 Hook，并保留跨阶段顺序和 continuation。进入阶段前核验 Hook 的触发、输入和授权边界，按清单读取当前检查点。

- [入口就绪](../hooks/entry.md)
- [Session 就绪](../hooks/session.md)
- [工作定义](../hooks/planning.md)
- [Single-Agent 执行](../hooks/execution.md)
- [委派执行](../hooks/delegation.md)
- [验证与修复](../hooks/verification.md)
- [文档](../hooks/documentation.md)
- [交付与验收](../hooks/delivery.md)
