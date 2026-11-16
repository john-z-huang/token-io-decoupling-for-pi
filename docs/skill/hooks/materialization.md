# 可选候选预检与受保护物化

## 触发条件

Agent 上报 `materialization_requested`；或实际出现需审阅/应用的候选输出。此 Hook 不自行创建或应用文件。

## 执行要求

1. 候选合规预检只检查候选/结构，不替代真实最终验证，也不证明身份、授权、角色、epoch 或语义验收。
2. 准备、审阅、应用三段分离；每段明确已授权根目录、精确目标路径、来源与当前指纹。先审阅具体输出再申请/消费真实 guard/grant，不能自造 trusted identity、scope 或原子事务回执。
3. 只使用服务实际支持的调用身份与路径契约。本轮没有修改 MCP 的 Pi 身份/物化接入；不把 Pi ID 包装为旧来源，不借用别人的 grant，也不据 Hook 或 Schema 存在宣称可用。
4. 受保护路径的失败、冲突、过期或拒绝，停止该分支并报告；不得切换直接文件/Shell/另一个代理落盘绕过既选守卫。其他独立、未依赖该受保护路径的获准工作按 owner 判断。
5. 实际应用后核对最终状态并使受影响验证证据失效；保留候选与最终状态的区别。

## 退出与阻断

可信身份、独立有效 grant、精确作用域、具体审阅及实际应用/验证证据缺一则阻断依赖物化。

## 重新核验

候选、目标、路径、身份、授权、指纹/epoch 或 grant 变化时重新准备/审阅，未知效果先读回。

## 规则来源

- [candidate-compliance.md](../references/coding/layer-01-fundamental-concepts/execution-planning/candidate-compliance.md)
- [output-materialization.md](../references/coding/layer-01-fundamental-concepts/execution-planning/output-materialization.md)
