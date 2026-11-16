# 有界 Context、Memory 与交接

## 触发条件

进入 `definition` / `documentation`；`context_exchange` 信号；真实跨上下文任务、memo、index 或 handoff 之前。

## 执行要求

1. 渐进式获取完成任务所需的中性事实和准确 source pointer；capsule/fingerprint 不能代替直接权威规则，index/Hash 不能代替正文。Root 仍须亲自核验指令、环境与相关代码事实。
2. Memory 必须使用实际获准后端、项目绑定、准确名称和权限；可见/同名不是技术 ACL 或跨 Session 访问保证。只读获准具名内容；缺少必需访问能力只阻断依赖工作，不通过普通文件或 Shell 绕过。
3. 执行 memo 与共享计划不同。明确 write_content_memo；false 不写执行 memo，但不豁免共享计划更新。true 时须在当前授权中指定已获准的确切名与贡献范围；父级派发先核验必需读取能力，不向工具传模糊目录权限。
4. memo/共享记录更新保持完整内容与可追溯来源，串行单写者协调；未知/过时基线先读回，不盲目全文覆盖。父级 mode/count/allocation/epoch/实时 Slice 留在父级会话，不写 Memory。
5. Handoff 明确项目/源 workspace、任务与 Contract 摘要、已完成效果、当前/剩余、证据/失败、允许贡献与返回位置。跨 workspace 传描述/指针，不凭文件同名认为内容同步；无必需返回路径时停止。

## 退出与阻断

必要上下文可访问、来源与贡献范围明确才进入依赖动作；不展开原始同级/父级 transcript。

## 重新核验

上下文失效、写者切换、并发/冲突、项目绑定/名称/权限变化时按 owner 刷新。

## 规则来源

- [context-exchange.md](../references/coding/layer-01-fundamental-concepts/context-exchange/context-exchange.md)
- [content-memo.md](../references/coding/layer-01-fundamental-concepts/context-exchange/content-memo.md)
- [context-exchange-handoff.md](../references/coding/layer-01-fundamental-concepts/context-exchange/context-exchange-handoff.md)
- [context-exchange-workspace-boundary.md](../references/coding/layer-01-fundamental-concepts/context-exchange/context-exchange-workspace-boundary.md)
