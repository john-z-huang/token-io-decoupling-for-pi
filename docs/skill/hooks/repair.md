# 修复范围与验证回环

## 触发条件

验证边界识别失败，Agent 通过 `repair_required` 上报；不能从命令中出现 fix/test 推断修复已发生。

## 执行要求

1. 先应用 Repair Scope Gate：判断失败原因、实际对象、原 Contract/授权和影响面。缺失能力或环境问题不伪装成产品修复；风险/授权冲突停止依赖动作。
2. 原 Contract 内修复才返回已授权执行路径并重新释放 Slice；需要新增目标、架构、范围或验收变化时先 signal requirements_changed/decision_required，重新完成相应入口/Decision/共享计划。
3. 修复以实际工具结果和新增当前状态证据返回 Handoff；记录修复了什么、未完成什么、失败/风险与返回的 Verification 位置。不得在旧 memo/计划缺失时猜测状态，不自动重放未知操作。
4. 执行/修复之后回当前 Verification，失效受影响 epoch；若修复发生于文档/Git 复核过程，保留原外层 continuation，最终只恢复原文档/验收位置。

## 退出与阻断

有界修复或有证据的 Repair N/A；修复完成不是验收，必须重验。

## 重新核验

修复引入新事实、越界、检查再次失败、上下文/授权变化时重新分类，不无限自动重试。

## 规则来源

- [repair.md](../references/coding/layer-02-workflow-concepts/verification-and-repair/repair.md)
- [repair-scope-gate.md](../references/coding/layer-02-workflow-concepts/verification-and-repair/repair-scope-gate.md)
- [repair-verification-handoff.md](../references/coding/layer-02-workflow-concepts/verification-and-repair/repair-verification-handoff.md)
