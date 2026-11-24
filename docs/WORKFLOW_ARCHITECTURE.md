# 工作流架构

- **Skill 指令**从入口、Coding 选择器进入单代理或多代理路线。路线规定阶段顺序，Hook 合同规定触发条件、所需证据和通过或阻断条件。 [Skill 入口](../rules/SKILL.yaml) · [Coding 选择器](../rules/workflows/coding.yaml) · [Hook 合同](../rules/hooks/README.yaml)
- **宿主适配**将实际会话、委派和 Memory 能力接入共用规则。Agent 核对当前会话和操作授权，再读取适用合同。 [宿主能力边界](../rules/references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.yaml) · [Codex 适配](../rules/references/hosts/codex.yaml) · [Pi 适配](../rules/references/hosts/pi.yaml)
- **配套脚本**将 `rules/` 中的 YAML 编译为同一份 Markdown Skill，检查产物和文档引用，并按宿主发布。 [文档维护](DOCUMENTATION_STANDARDS.md) · [安装与更新](../INSTALL.md)
