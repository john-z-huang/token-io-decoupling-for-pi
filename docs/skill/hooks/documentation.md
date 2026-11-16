# 文档影响与复核

## 触发条件

进入 `documentation`；真实文件写入被归类 documentation；或 Agent 上报 `documentation_impact`。

## 执行要求

1. 先核验实际改动、当前验证与适用文档输出。普通非 Skill 文档/注释由 Root 编写，不占用 Primary 名额；本 Skill 指令/参考文档在原有门禁齐备时可由 Primary 输出，Root 仍须审阅。
2. 只编写获准输出；无变化也要给有证据的理由。Memory 项目持久化另核授权与后端，不用文档写入替代必需 Memory。Hook 不自行启动命令；Agent 可执行原任务已授权的必要工具步骤。
3. DOC04 分类写后影响：纯文档、规则/入口、Contract、验收、实现含义、索引/引用和下游。影响内容/Contract/验收时上报真实变化，返回相应 Decision/Verification，不凭 .md 扩展名认定行为不变。
4. 运行适用链接、结构、内容和项目文档检查，报告实际证据和缺口。扩展对文档 epoch 变化保守返回 Verification，完成后恢复 DOC04 分类及 DOC05 检查，不重新写入 DOC02。
5. 共享计划实质更新遵循单写者、内容保全与边界；只有另行明确授权的项目 Memory 才写，实时父级调度记录不写入其中。

## 退出与阻断

文档输出/无变化理由、影响分类与当前检查证据齐备才退出；影响未知或必需检查缺失阻断依赖。

## 重新核验

继续写入、语义/Contract/验收变化或证据过期时重新分类；纯文档影响完成后恢复原文档子步骤。

## 规则来源

- [documentation.md](../references/coding/layer-02-workflow-concepts/completion-and-effects/documentation.md)
- [documentation-impact.md](../references/coding/layer-03-workflow-checkpoints/documentation-impact.md)
