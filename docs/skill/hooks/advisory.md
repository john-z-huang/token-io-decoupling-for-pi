# 可选咨询与出站边界

## 触发条件

Agent 主动上报 `advice_requested`；必须已有真实可用 API/工具及本次出站授权，不因 Hook 被注入而联网。

## 执行要求

1. 咨询只给建议，Root 仍完成事实确认、决策、授权和验收；缺少建议能力可直接依据 owner，不虚构调用结果。
2. 真实出站仅发送本次所需的最少获准事实，排除秘密、凭据、无关上下文和原始 transcript。Mock 为默认，本轮扩展自身不创建 OpenAI 客户端、读取密钥值或发 API 请求。
3. MCP Tools 内部执行方式保持不变：每次真实调用读取非空 OPENAI_API_KEY 与 OPENAI_BASE_URL，固定模型 gpt-6-luna，不输出凭据；Pi 主会话/子任务模型与此 API 模型独立。
4. 工具返回失败/缺配置/不适配时按 owner 处理，不叠加整工具重试；不得切换身份、放宽受保护权限或偷偷换直接写入路径。

## 退出与阻断

无出站授权/必需配置不调用；可选咨询不可用不阻断独立且获准的 owner 路径。

## 重新核验

数据范围、授权、端点/模型要求、能力或建议所依据的事实变化时重核。

## 规则来源

- [decisions-advisory.md](../references/coding/layer-01-fundamental-concepts/execution-planning/decisions-advisory.md)
- [advisory-selection.md](../references/coding/layer-03-workflow-checkpoints/advisory-selection.md)
