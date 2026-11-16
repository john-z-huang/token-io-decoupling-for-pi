# 缺前置、恢复与不重放

## 触发条件

真实会话恢复/重载、`session_tree`、`session_compact`、abort、新用户输入、未知效果或检查点 needs_prerequisite/blocked。

## 执行要求

1. 记录原模块/子步骤、负责 prerequisite 的 owner、已完成效果、必要 epoch 和返回位置；只有相应 owner 补齐并读回核验后才能原位恢复，不重跑整条路线。
2. Continuation 与效果状态分开。中断或未知效果先读取当前实际文件/后端/调用记录；使用 resolve_effect 引用真实 read/check，再 resume；不因为工具返回丢失而重发写入/派发/归档等动作。
3. Session 树回退不回退文件系统和已占用预算。只恢复当前分支的流程位置；整个 Session 的已绑定 allocation 不因历史导航回收。fork 为新实际 Session，不能伪造继承身份或已完成位置。
4. 重载/压缩后旧 Verification/Slice 不视为新鲜。状态版本/规则 Hash/Session/目录不匹配时保持阻断，保留旧记录，要求用户处置或新 Session，不清空数据假装新任务。
5. 只读回所需事实；来源、owner、原位置、效果或进展不明时阻断依赖工作。失败不换工具入口绕过守卫，也不通过多次自动重试伪造进展。自动续跑最多8次，同一检查点无进展只补一次提示；需要用户判断时立即 pause。
6. 大结果分页缓存仅在当前进程；reload 后缓存丢失必须从真实输出来源重新读取，无来源就报告缺口，不能重跑副作用任务来换取结果。

## 退出与阻断

当前前置与读回证据齐备、未知效果解决，才恢复原位置和重新放行 Slice。

## 重新核验

每次恢复、树导航、压缩、abort、并发/权限/来源变化后重新核验；历史完成不能证明当前磁盘状态。

## 规则来源

- [workflow-module-contract.md](../references/coding/layer-01-fundamental-concepts/execution-planning/workflow-module-contract.md)
- [session-model.md](../references/coding/layer-01-fundamental-concepts/session-runtime/session-model.md)
- [module-entry-resolution.md](../references/coding/layer-03-workflow-checkpoints/module-entry-resolution.md)
