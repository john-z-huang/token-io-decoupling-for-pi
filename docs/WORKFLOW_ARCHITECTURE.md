# 工作流架构

- **Skill 指令**从入口、Coding 选择器进入单代理或多代理路线。路线规定阶段顺序，Hook 合同规定触发条件、所需证据和通过或阻断条件。 [Skill 入口](../rules/SKILL.yaml) · [Coding 选择器](../rules/workflows/coding.yaml) · [Hook 合同](../rules/hooks/README.yaml)
- **Pi 执行环境**提供会话和工具。Agent 按当前任务读取适用指令，核对宿主实际提供的能力与操作授权，再根据结果决定下一步。 [运行时能力边界](../rules/references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.yaml)
- **配套脚本**将 `rules/` 中的 YAML 编译为 Markdown，检查生成结果和文档引用，并更新 Pi 可发现的本地 Skill。 [文档维护](DOCUMENTATION_STANDARDS.md) · [安装与更新](../INSTALL.md)
