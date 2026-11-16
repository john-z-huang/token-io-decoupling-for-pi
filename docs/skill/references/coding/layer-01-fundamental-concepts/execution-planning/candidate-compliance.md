# 候选变更合规预检


本文档定义对拟议仓库变更进行可选只读结构预检的规范。它不拥有写入授权、完整验证或最终验收。

## 通用规范

### 对照可信的当前状态检查候选内容

当已授权工作流需要提前获得结构反馈时，可将一组候选变更作为内存覆盖层，与可信检出内容一起检查。候选文件可相互满足直接的本地链接检查。基线记录观察到的文件状态；它不是锁、写入授权，也不保证状态保持不变。

策略范围必须明确。只有 `skill_maintenance` 请求适用 Skill 维护规则；`generic_project` 请求不得默默把本仓库的 Skill 规则应用到其他项目。配置了可信服务时，该服务还会限制可请求的范围。未配置读取器时，仍可执行候选内容的静态检查；依赖可信磁盘状态或基线证据的检查应为 unknown，而不是通过。候选请求不得选择自身可信根目录或策略来源。

分别将结果解释为 pass、fail、unknown 或 not applicable。将 unknown、失败、因限制未返回的检查以及过期基线视为未解决。修正原因或补齐证据后，应针对当前候选内容重新运行。成功预检只覆盖该覆盖层与读取器观察实际返回的检查。

预检不会扫描未变更文档中的反向入站链接、证明中文正文的语义正确性、执行仓库代码、运行所有项目检查、授权应用文件，也不替代当前状态 Verification 和 Acceptance。变更应用后仍须完成适用的权威检查。

## Pi Coding Agent 优化指令

当前项目 Server 的 Pi 接入与结构校验契约尚未完成迁移。只有核实工具适用范围、可信读取器和调用身份后才使用；否则记录可选预检 Not applicable，使用授权的本地文档检查。无论哪条路径都不能将候选检查当作最终状态验证。


## 相关概念

- [Session Role Ownership](../session-runtime/session-role-ownership.md) — 拥有可信身份和逐次调用守卫。
- [Workflow Routing Advice](workflow-routing-advice.md) — 拥有可选阶段建议。
- [Output Materialization](output-materialization.md) — 拥有受控输出准备与应用。
