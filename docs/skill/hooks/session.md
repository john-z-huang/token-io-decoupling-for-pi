# Session 与角色

## 触发条件

进入 `session` 模块；会话启动/恢复、`session_tree` 导航或 `capability_changed` 后。

## 执行要求

1. Root 保留语义决策、指令分析、环境/代码事实确认、Slice 放行、用户交互和最终验收，不把这些前置工作委派出去。扩展的 agent 配置名不等于职责授权。
2. 规范记录绑定实际当前 Pi Session、项目、mode/count、逻辑 allocation 与任务状态；父级调度事实属于当前会话，不写入共享计划、memo 或其他 Memory。持久化扩展状态只是宿主 Session 记录，不是数据库原子预留。
3. 四种职责分别唯一：Primary Output、Change Verification、Context Bootstrap/Refresh、Documentation/Comments & Git Operations。验证者不参与被审实现；Context 只产中性事实 capsule；普通非 Skill 文档/注释归 Root；最后一种职责只执行单独放行的非简单 Git Slice。
4. Single count=0 且不创建子任务；Multi count 为已锁定正整数。未分配、运行、完成/失败的名额均有意义；完成/失败不自动回收，不能因任务结束或树导航重新计数。只有用户为不同职责明确加一名额才扩容。
5. 不假定稳定子 Session ID、消息、wait/resume 或会话复用。缺少某项能力只阻断依赖分支；一次性真实任务可完成 Slice，但返回不等于可复用会话。

## 退出与阻断

角色/预算/来源状态一致，且没有待处理的未知效果；不能核实则暂停。

## 重新核验

新事实、角色/权限变化、树导航、压缩或重新加载后核对实际状态；文件系统不会随对话树倒退。

## 规则来源

- [session-model.md](../references/coding/layer-01-fundamental-concepts/session-runtime/session-model.md)
- [session-role-ownership.md](../references/coding/layer-01-fundamental-concepts/session-runtime/session-role-ownership.md)
- [delegation-state-record.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-state-record.md)
