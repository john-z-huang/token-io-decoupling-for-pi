# 交付、验收与计划归档

## 触发条件

进入 `delivery`；真实 Git 影响；或 `git_changed` 信号。命令/包装的名字不证明实际 Git 状态。

## 执行要求

1. DA01 先核当前最终 Verification。Git 操作必须独立、明确请求并授权；修改/模式/count/计划/扩展续跑不自动授权提交、推送、合并、删除或历史重写。未请求 Git 记有理由 N/A，不自动做“交付”。
2. Git metadata 等相关影响使验证/验收证据过期时返回 Verification，并从 DA03 逐标准映射继续，不重放 DA02 命令。此版未提供合格非简单 Git 子代理适配器，需要该能力的分支保持阻断；不能由通用 worker 冒充。
3. DA03 对每项 Acceptance 标准列当前 epoch、真实检查/审阅证据、满足/未满足与限制；总体 satisfied、Hash、结构通过或工具成功均不能代替逐项语义判断。
4. 所有适用 Acceptance 通过后才完成共享计划：以完整当前基线保留所有累计目标/约束、来源事实、需求变化、理由、贡献、失败和验证记录，仅更新状态并追加最终结果/限制；最终摘要不可替换全文。
5. 归档前完成内容保全核验，保留最终活动内容基线，确认准确匹配归档名不存在；只移动本任务已完成计划的名称，字节不变。使用有效生命周期核验回执；没有该能力时仅在 owner 允许且授权的原生 Memory 路径进行必要全文比对，核实归档存在、活动名消失且内容完全相同。
6. 碰撞、结果不明、读取/移动/核验失败即停止，保留记录；已有归档不可编辑、删除、重命名或替换，不能为修复比对而改归档。用户明确禁止持久化的既定例外不虚构归档。
7. DA05 报告实际完成范围、证据、未执行/不适用检查、假设、风险与未授权效果。只在实际验收完成时称 COMPLETE；引擎状态 complete 只说明声明的结构化门禁已走完。

## 退出与阻断

验收逐项通过、未知效果清零、适用计划归档有保全证据后退出；不自动推送或删除任何用户备份。

## 重新核验

交付期间的内容/Git/文档变化、检查失效、归档未知或验收变更必须重新核验。

## 规则来源

- [git.md](../references/coding/layer-02-workflow-concepts/completion-and-effects/git.md)
- [acceptance.md](../references/coding/layer-02-workflow-concepts/completion-and-effects/acceptance.md)
- [task-plan-memory-lifecycle.md](../references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md)
