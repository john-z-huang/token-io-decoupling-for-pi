# 运行环境检查点


## 动作

1. 读取当前系统、开发者和应用上下文中的明确运行元数据。如果元数据明确指出受支持的运行环境，将其作为主要事实。
2. 使用当前已暴露的可调用工具清单、工作区根目录、权限配置、沙箱信息和其他任务元数据作为辅助证据。不能仅凭本地 Shell、worktree、模型名称或工具特征唯一确定运行环境。
3. 当前任务授权时，只检查本地进程或环境信息中暴露的非敏感运行元数据；不得输出或持久化凭据、令牌。
4. 不得使用浏览器、GUI 导航、截图或页面视觉内容来识别运行环境。
5. 根据[运行时与能力边界](../../layer-01-fundamental-concepts/session-runtime/runtime-provider-support.md)，核对当前宿主的明确事实和任务所需能力，不再执行多产品分支选择。
6. 运行时事实缺失、冲突或必需能力不可用时，记录具体证据并停止依赖该事实或能力的工作；可选能力缺失按其 owner 记录不适用原因。
7. 只向用户询问阻塞当前任务的具体缺口，不要求选择已取消的运行环境分类。

## 通过条件

当前运行时事实与任务必需能力有明确证据，或已记录具体缺口并暂停依赖工作；不存在未处理的运行时冲突。不以多产品分类问卷或工具名称代替核验。

## 边界

本检查点不选择执行模式，不将模型绑定到角色，不授权委派，不实现修改，也不声称已经执行未观察到的操作。

## 相关概念

- [Coding Session Model](../../layer-01-fundamental-concepts/session-runtime/session-model.md) — 定位 Session 拓扑归属。
- [Coding Context Exchange 工作区边界](../../layer-01-fundamental-concepts/context-exchange/context-exchange-workspace-boundary.md) — 定位文件系统和 worktree 能力归属。
- [Coding Delegation Mode Confirmation](../../layer-01-fundamental-concepts/delegation/delegation-mode-confirmation.md) — 定位模式门禁能力消费者。
- [工作流导航可用性](../../layer-01-fundamental-concepts/workflow-navigation/navigation-availability.md) — 定位可选路线选择和不可用处置。
- [Session 角色归属](../../layer-01-fundamental-concepts/session-runtime/session-role-ownership.md) — 定位当前会话范围及操作守卫证据。
