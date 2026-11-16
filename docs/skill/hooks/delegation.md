# 有界委派与一次性任务

## 触发条件

Multi 的 DE03–DE07；`coding_delegate` 实际创建/派发前；VR02 要求独立验证时。不得因锁定预算、bootstrap 或展示菜单创建代理。

## 执行要求

1. 先确认实际任务授权、intent/output 资格、执行者与输出路线，再选择职责、预留预算并放行 Slice。Root 的前置事实确认和语义决策不可外包。Primary 仅用于真实代码/配置实现或本 Skill 指令/参考文档输出；普通文档/注释由 Root；Context 只产中性项目事实；独立 verifier 只读实现与 Git。
2. 本适配器只接纳实际可调用且 Schema 明确为单任务 `agent`/`task`/`cwd` 的工具，不使用未暴露/hidden 工具、不猜扩展配置名。没有兼容扩展时只阻断委派，不能伪造子 Session 或把根会话改名当子代理。
3. DE05 完成创建前核验；DE06 一次真实工具调用完成创建、派发、执行和返回；DE07 消费并审阅实际完整结果。同步一次性任务不再调用 wait/resume/dispatch，不因没有持久句柄而重放任务。异步扩展须有独立真实适配器，此版不模拟。
4. 预留为父级进程中的串行逻辑协调，不是服务端原子事务。每个 allocation 绑定实际父级调用/任务结果与唯一职责；完整结果、失败、未决项都必须返回。实际任务终态不释放名额；仅宿主明确证明 execute 未运行时可撤销未绑定预留，不从错误文本猜测未创建；替换/继续只有真实扩展支持且用户授权时才可，不复用一次性结果冒充 Session。
5. 并行派发必须独立、路径不冲突。任务显式禁止递归创建/派发、Computer Use、未授权网络/Git/Memory 与扩容。合同不是隔离沙箱；此扩展不能保证外部进程或另一扩展内部工具全部受当前 Hooks 覆盖。若该隔离是必需条件，缺少实际能力就阻断。
6. 此版不提供 Git 专用子代理或持久任务复用适配器；不能把一个通用 worker 设成该角色后宣称符合。需要它们的分支按 owner 保持阻断。

## 退出与阻断

有真实一次性结果且逐项读完后才接受；大结果用 result 分页读完，不靠摘要/Hash/状态词验收。未知效果先读回，不重派。

## 重新核验

任务/职责/工具 Schema/能力/路径冲突或需求变化时重核；父级维护模式、预算和来源。

## 规则来源

- [delegation-child-creation.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-child-creation.md)
- [delegation-child-dispatch.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-child-dispatch.md)
- [delegation-child-lifecycle.md](../references/coding/layer-01-fundamental-concepts/delegation/delegation-child-lifecycle.md)
- [delegated-execution.md](../references/coding/layer-04-workflows/modules/delegated-execution.md)
