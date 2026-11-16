# 安全摘要与实际返回正文

## 触发条件

进入 `session`；真实子任务/结果返回；审计偏好改变或 required audit 不可用时。

## 执行要求

1. Root 默认 reasoning_summary_visibility=balanced、reasoning_summary_frequency=milestone_only；Worker 默认 full。立即应用用户显式偏好或默认，不问无必要配置问题，不将可见性设置设成前置。
2. full 指安全的工作/推理摘要覆盖，不是私有思维链、逐 token 思考、隐私或凭据。只展示必要事实、决定理由、变化、检查、失败和未决项；默认不重复打印完整最终返回。
3. 父级须读完实际 Worker 最终任务正文，不以索引、提纲、Hash、usage 或笼统成功词替代；结果过大时按真实返回分页读完，不重跑任务换短摘要。
4. 只使用平台真实暴露的父级历史/消息/日志能力；没有持久消息流的一次性扩展不伪装可见其完整会话。确有必需原文不可访问时阻断依赖，普通获准且独立工作可继续。

## 退出与阻断

摘要与实际结果边界明确，所需正文已读；日志/来源缺口须显式说明，不伪造审计事实。

## 重新核验

结果截断、压缩/恢复、可见性偏好变化或证据来源变化时重核。

## 规则来源

- [session-audit-visibility.md](../references/coding/layer-01-fundamental-concepts/session-runtime/session-audit-visibility.md)
- [reasoning-summary-visibility.md](../references/coding/layer-01-fundamental-concepts/session-runtime/reasoning-summary-visibility.md)
- [delegation-child-message-visibility.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-child-message-visibility.md)
