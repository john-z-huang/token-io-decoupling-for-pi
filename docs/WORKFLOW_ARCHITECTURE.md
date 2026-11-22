# 工作流架构

## Skill 与宿主

- **Skill 定义流程**。从[入口](../rules/SKILL.yaml)读取 Coding 选择器、单代理或多代理路线及适用的 [Hook 合同](../rules/hooks/README.yaml)。路线定义阶段顺序，Hook 定义触发、证据、通过或阻断条件。Agent 据此结合当前事实推进。
- **Pi 提供执行环境**。Agent 核对会话、子代理能力、权限和结果。工具可用性与操作授权分别核验。 [运行时能力边界](../rules/references/coding/layer-01-fundamental-concepts/session-runtime/runtime-provider-support.yaml)
- **独立服务提供工具**。通用 Git 和托管平台操作按宿主实际暴露的工具和授权使用。若启用 `dev-workflow-standards` 的项目 Memory 工具，先核对 MCP 启动目录。规则上下文直接从当前路线、Hook 及其引用读取。

## 旧扩展归档

已归档的 Pi 工作流扩展保留供查阅。其宿主事件、路线注入及恢复信息属于历史实现。当前运行行为以 Skill 指令和实际宿主能力为准。
