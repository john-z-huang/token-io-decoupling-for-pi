# Context、Decision 与共享计划

## 触发条件

进入 `definition` 模块；`decision_required` / `requirements_changed`；以及受影响实施、派发、交接、暂停、完成之前的计划边界。

## 执行要求

1. 有 Issue 先读 Issue/讨论；无 Issue 按用户请求分析当前事实。初始临时计划不是实施放行。Root 亲自核对有界 Context 与 source pointer，区分待分析事实、提议、已接受决定；需语义决策时先完成 Decision Brief，再放行依赖动作。
2. 每项 Coding 默认在实施/依赖派发前使用获准 Memory 持久化具体共享计划，先在授权上下文审阅候选，确认实际写成功。用户/更高优先级明确禁止持久化才可在 WD03 引用准确来源记录 plan=prohibited；工具缺失、权限不明或写失败不是例外，也不能回退普通文件。
3. 先确认存储 scope、准确项目与维护说明。共享全局命名为 `global/token-io-decoupling/repos/<repository-id>/plans/PLAN-[short-english-summary]`，归档为同 key 的 `archive-plans/`。repository-id=`git-v1-`+SHA256(`b"token-io-decoupling:git-common-dir:v1\0" + os.fsencode(str(canonical_git_common_dir))`)，其中 `\0` 是单个 NUL，不是两个字符。主 workspace/linked worktrees 共用 canonical Git common directory；basename、分支、remote URL 均不能代替 key。身份/根移动不明即停，不静默回退旧项目本地存储。
4. 仅明确保留旧项目本地后端时使用 `plans/PLAN-...` / `archive-plans/PLAN-...`；逻辑名无 `.md`，实际根依获准配置。优先复用同任务具名活动计划；仅在名称未知时列相关 topic；可见的其他仓库不构成访问授权。不覆盖碰撞目标、不收编其他项目、不修改已有归档。
5. 计划包含目标/验收、来源、约束/非目标、已核实事实及指针、方向/开放问题、步骤/依赖/验证、完成/当前/剩余、检查/阻塞/风险。只作精简增量，不写 transcript、完整 diff、日志、凭据、私有推理或 mode/count/allocation/epoch 调度表。
6. 内容必须保全：追加新事实/贡献/失败/验证；旧结论标记被替代并保留理由、来源与原结论，不用最终摘要替换累积全文。需要内容比较或全文替换时，以完整且当前基线合并；优先唯一 literal 局部编辑。普通成功写回执不证明保全，也不一律要求全文重读；基线缺失/过期、写者交接、并发迹象、冲突、结果不明或显式验收要求时才刷新/全文比较。
7. 父级串行协调一个当前记录写者；其他角色提交获准、具名、带来源贡献，无须各自具备写工具，不假定原子锁/CAS。贡献不能改 Contract 或授予权限。影响范围/授权/验收/方向/依赖动作的变化，先记录待分析来源、分析影响、更新并确认写成功，再放行；其他实质更新可合并到下一阶段/交接/暂停边界。

## 退出与阻断

WD03 必须有实际 effect=memory 成功证据，或禁止持久化的权威来源。内容保全/访问/必需核验失败时阻断受影响动作，保留最后确认版本。

## 重新核验

任务改变、写者交接、暂停/恢复、内容失效或结果不明时重新核验相关前置；成功工具结果不等于语义或并发正确。

## 规则来源

- [execution-planning.md](../references/coding/layer-01-fundamental-concepts/execution-planning/execution-planning.md)
- [execution-decision-gate.md](../references/coding/layer-01-fundamental-concepts/execution-planning/execution-decision-gate.md)
- [task-plan-memory-lifecycle.md](../references/coding/layer-01-fundamental-concepts/execution-planning/task-plan-memory-lifecycle.md)
