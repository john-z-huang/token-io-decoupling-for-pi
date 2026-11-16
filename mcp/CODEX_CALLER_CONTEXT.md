# 调用方上下文与受保护能力

MCP 仅提供 `token-io-decoupling-tools`，面向 Pi 使用标准 stdio，无需启动参数。旧 Codex 双服务 setup 与 workflow 程序已删除。

普通工具发现、规则上下文查询、Serena Memory 只读检查不证明调用方拥有身份、任务分配或操作授权。Memory 路径范围固定为服务实际启动目录；需要读取目标项目时应在该项目目录启动服务，不搜索父目录或相邻仓库。

## 可信绑定边界

受保护材料化仍需要可信启动时注入的 BindingProvider、当前角色/分配与独立操作 grant。默认 stdio 不自动提供这些条件；未配置时返回不可用，不因服务支持 Pi 而降低检查。

Core 中保留的 Codex 调用方匹配器仅用于真实 Codex 元数据的受限集成，不是 Pi 身份适配器。不能将 Pi 会话 ID、请求参数或自报角色伪装成可信绑定；也不能把 Codex 来源工具用于伪造 Pi 会话事实。

安装与工具范围见 [开发指南](DEVELOPMENT.md)，材料化约束见 [输出材料化](OUTPUT_MATERIALIZATION.md)。
