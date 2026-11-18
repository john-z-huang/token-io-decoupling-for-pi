# Worker Content Memo Lifecycle

<!-- 由 docs/rules/references/coding/layer-01-fundamental-concepts/context-exchange/content-memo-lifecycle.yaml 生成。请在 DSL 中维护正文。 -->


本文档定义 Serena Memory Worker memo 的创建、更新、清理和可发现性，不定义 memo 内容、dispatch、handoff 授权或验收。

## 通用规范

### 创建、更新与发现

`write_content_memo` 为 true 时，使用 `list_memories` 检查具名条目，并在首次出现可复用状态以及实质里程碑、阻塞、handoff、replacement 或正常退出时，使用 `write_memory` 创建或更新 `context-exchange/workers/<worker-context-id>/content-memo`。只在状态/证据实质变化时更新，不要逐命令记录。父级或后继者只有在已放行指令具名或授权该记录时才能读取；Serena 本身不强制该归属规则。这些记录不另建本地文件索引；名称可通过 Serena Memory 列表发现。

Memory 能力失败时必须报告，并阻塞依赖该记录的工作；不得回退为文件写入。遵守 memo 内容契约，不得写成命令日志。

## Pi Coding Agent 优化指令

Serena 是可选外部 MCP。需要 Memory 时，通过 Pi codemode 的 `searchTools`、`describeTool`、`describeNamespace` 核实实际工具与 schema，调用时检查 `isError`；hidden 工具不得绕过。确认真实项目绑定及 Memory Schema。Memory 名称、内容、持久化及禁止回退文件、授权隔离和边界均按通用规范；能力缺失只阻塞依赖项。Pi 的 `read`、`edit`、`write`、`bash` 可按授权直接访问文档，不代表 Serena Memory 能力。旧身份上下文不可伪造。

## 相关概念

- [Worker Content Memo](content-memo.md) — 定位 memo 内容契约。
- [Worker Content Memo Dispatch](content-memo-dispatch.md) — 定位 memo 开关。
