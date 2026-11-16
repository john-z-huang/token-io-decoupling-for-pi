# Slice、Control 与阶段反馈

## 触发条件

进入 `execution`；`coding_slice` 放行前；到达 return conditions、实质边界或工具失败后。Bash/codemode/MCP 的副作用由 `coding_run` 显式声明，不能靠命令名推断。

## 执行要求

1. Slice 四字段：Objective；Authorized scope/mutations（精确文件和行为）；Return conditions（证据/里程碑）；Unreleased boundary（尚未放行的子系统、风险、语义选择或变更）。此扩展将路径限定为仓库内精确相对文件，拒绝目录、穿越和外部符号链接；这不是 OS 沙箱。
2. Slice 不是逐命令脚本。在 Contract/边界不变时可连续处理低决策密度机械步骤；相互独立、无依赖/路径冲突的已放行工作才可并行。到达返回条件或未放行边界之前暂停。
3. Progress Signal 指出进展、偏差、新证据、阻塞和下一边界。最终 Control 只有 Continue / Amend / Stop；Evidence-on-Demand 是暂停求证的中间动作，不是第四种放行。Continue 只释放下一有界 Slice；Amend 先改 Contract/计划/边界；Stop 停止依赖动作。
4. 单代理 Control 是内部推理暂停，不模拟给自己发消息。Root 负责语义与最终验收；实施者只处理已放行实现/配置/Skill 输出、范围内修复和临时检查，不接管未解决架构决定。
5. 使用实际调用结果；错误须明确 isError/exit code/不可用状态。`effect=read/check` 是 Agent 对真实行为的声明，不证明命令无副作用或已获授权；不得标错分类避开 Slice。

## 退出与阻断

返回有界实际结果、路径、检查、失败和未决项；未释放范围/新决策/未知效果阻断。

## 重新核验

内容、文档、Git 或依赖证据变化使相应 epoch 失效；变更不能沿用旧 Verification。

## 规则来源

- [execution-control.md](../references/coding/layer-01-fundamental-concepts/execution-control/execution-control.md)
- [execution-stage-feedback.md](../references/coding/layer-01-fundamental-concepts/execution-control/execution-stage-feedback.md)
- [task-assignment.md](../references/coding/layer-01-fundamental-concepts/execution-planning/task-assignment.md)
