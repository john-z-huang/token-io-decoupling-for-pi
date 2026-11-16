# 唯一 MCP 工具程序

仅注册 `token-io-decoupling-tools`，参数为空，使用 stdio。通过 `uv tool dir --bin` 找到安装位置，并在 Pi 实际使用的 MCP 配置中填写该程序的绝对路径。安装脚本不修改用户配置。

固定 38 个工具的权威清单见 `packages/token_io_decoupling_core/src/token_io_decoupling_core/server_tools.py`。33 个上游开发工具依赖固定版本的 dev-workflow-standards-tools；另有规则上下文、合规预检、两个 Serena Memory 只读工具和输出材料化。保留所有操作的授权、路径和外发检查。工具发现不证明受保护能力可用。

程序不再提供 workflow 调度、task-plan 或旧 setup 命令。安装、Skill 更新及验证见 [开发指南](DEVELOPMENT.md)。
