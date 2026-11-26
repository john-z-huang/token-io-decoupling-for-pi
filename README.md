# Token I/O Decoupling

> 本项目的代码已合并到 `john-z-huang/token-io-decoupling`。本仓库作为历史归档保留，不再更新。后续开发和维护在迁入仓库进行。 [迁入仓库](https://github.com/john-z-huang/token-io-decoupling) · [迁移 PR #237](https://github.com/john-z-huang/token-io-decoupling/pull/237)

Token I/O Decoupling 是用于开发任务的编排 Skill。主代理依据用户指令、任务依赖和当前会话的可用能力选择工作流，按需读取 Hook，负责推进任务和最终验收。

## 工作流

- 用户明确要求不创建子代理，或主代理判断任务无需委派时，按[单代理路线](rules/workflows/coding-single-agent.yaml)执行。
- 用户明确要求委派或任务适合委派时，按[多代理路线](rules/workflows/coding-multi-agent.yaml)确定分工，依据子任务依赖和[四类角色的职责](rules/references/delegation/delegation-policy.yaml)动态选择所需角色、数量、模型和推理强度。优先复用同一角色的可用实例，仅在上下文过长、故障无法修复或运行状态异常时按需替换。新建子代理禁止使用 Ultra 推理强度。
- 主代理按当前动作从 [Hook 目录](rules/hooks/README.yaml)读取触发条件、交接、恢复和验收要求。

参见[安装与更新](INSTALL.md)及[文档维护规范](docs/DOCUMENTATION_STANDARDS.md)。调整前的规则、角色、工具和维护文档保存在[历史快照](archive/pre-orchestration/)。
