# Session 审计解决


本检查点负责将当前 Session 已完成启动收集的审计偏好应用于父级控制记录，并核对最终值。启动答案收集是流程前置，不是权限、独立验证或日志能力证明。

## 触发与输入

取得规范 parent-context 记录后，使用该记录和当前 Session 审计事实。应用[Session Audit Visibility](../layer-01-fundamental-concepts/session-runtime/session-audit-visibility.md)了解字段值与显示语义，并应用[委派状态记录](../layer-01-fundamental-concepts/delegation/delegation-state-record.md)了解记录归属和结构。

## 决策与结果

首次启动固定先确认 single/multi 及有效预算，再收集审计偏好。有效显式字段不重复询问；缺失字段必须由用户选择使用默认（`balanced/milestone_only/full`）或定制，逐字段记录 `explicit/default` 来源。取消、未回复或无效答案不隐式使用默认；答案未齐不创建 Workflow、不执行工具。非 UI 必须显式提交答案或清晰阻断，不伪造用户选择。

同一 Session 已确认的值和逐字段来源跨完成后新任务、树导航、reload/resume 保留，不重问、不回收预算；fork/new Session 重新收集。损坏或冲突的恢复状态失败关闭，不能通过新任务重置。volatile 只保留当前进程内答案，不 appendEntry，丢失后不能依赖日志声称可恢复；须新建 Session。忽略旧提示/计时字段，不把它们当作用户答案。不得启动计时器或超时自动选择默认值。

Worker 日志可见性仍只是证据描述。若任务依赖访问完整安全 Worker 会话记录，只能依据实际访问证据报告 `available`、`unverified` 或 `unavailable`；不存在 Worker 时，记录带理由的 `Not applicable`。若该证据是必需的且不可用或未验证，则仅阻塞依赖它的审计判断。仅返回最终正文或发现工具均不能证明可访问完整日志。

## 失败边界

启动偏好收集必经，绝不授予授权。完整确认后才进入流程；有效会话答案复用，不逐任务重新问。保留必需进度报告和保密规则。Worker 日志证据缺失仅阻塞依赖该证据的判断，不得把偏好、摘要或日志字段视为完成证明。

## 相关概念

- [Session Audit Visibility](../layer-01-fundamental-concepts/session-runtime/session-audit-visibility.md)
- [Coding Delegation State Record](../layer-01-fundamental-concepts/delegation/delegation-state-record.md)
