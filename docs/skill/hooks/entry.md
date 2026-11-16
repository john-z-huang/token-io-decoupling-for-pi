# 入口就绪

## 触发条件

进入 `entry` 模块；或结构化信号 `requirements_changed` / `capability_changed`。新用户输入只触发暂停核对，不能自动推断 Contract 已变。

## 执行要求

1. 在 ER01 明确目标、来源、硬约束、已授权效果、非目标、开放问题、验收标准及 independence=required/not_required；从直接权威来源确认 task intent 与 eligible output classification。未解决的问题不是实施授权。
2. 核验准确项目/worktree、工具 Schema、运行环境能力清单、Memory 后端与实际服务状态。工具暴露不等于支持、权限或后端可用；缺少必需能力时暂停依赖动作。
3. `/coding single <任务>` 明确选择单代理、count=0；`/coding multi [正整数] <任务>` 明确选择多代理，未填数量为1。命令只选择路线，不创建代理、不释放 Slice。不启用扩展时沿用旧 Skill 的模式菜单及默认策略，扩展不从普通提示词猜模式。
4. 已锁定的 mode/count 后续复用；路线入口只在实质路线事实改变时重核。此版同 Session 不提供模式切换；不通过重启任务清空预算。可选导航不适用时依据 owner，不为其伪造旧宿主身份。

## 退出与阻断

Contract、Environment、能力与已选模式一致才退出；冲突/不明则报告具体 owner、原位置和已有效果。

## 重新核验

需求、验收、项目、能力或授权实质改变时重核；保留既有 effects 与 allocation。

## 规则来源

- [contract.md](../references/coding/layer-02-workflow-concepts/entry-and-context/contract.md)
- [environment.md](../references/coding/layer-02-workflow-concepts/entry-and-context/environment.md)
- [mode.md](../references/coding/layer-02-workflow-concepts/entry-and-context/mode.md)
- [route-entry.md](../references/coding/layer-03-workflow-checkpoints/route-entry.md)
