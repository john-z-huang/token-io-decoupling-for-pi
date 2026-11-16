# 当前最终状态验证

## 触发条件

进入 `verification`；文件/文档/Git 影响使原 receipt 过期；真实检查失败后。

## 执行要求

1. VR01 捕获当前实际最终状态与范围/fingerprint，不验证计划中的未来状态。扩展以 content/documentation/git 三维 epoch 作保守失效标记；未纳入本宿主的外部改动仍需 Agent 主动读回或 signal 报告。
2. 检查必须在实际已授权环境运行，区分 tests、static checks、manual review、state reads 与 unavailable。通过 coding_run effect=check 绑定真实调用及当前 epoch；exit code、输出正文、失败/跳过/覆盖缺口由 Agent 审阅，不能仅凭 !isError 或 verification=passed 声明证明测试通过。
3. 按 Contract 核验独立性。独立 verifier 必须未参与被审实现；同一上下文改名、换措辞、重复同一路径不成立。真实外部/用户提供的独立审阅也须核实来源及覆盖面；只存在一个 user 引用不证明审阅成立。
4. 范围、证据类别、命令/方法、实际结果、失败/限制与验收映射分别报告。检查不可用不当作通过；失败先分类缺能力/范围内修复/Contract 变化，再走对应分支。
5. 已发生文档或 Git 影响后，回本模块验证相关当前状态，再返回 DOC04 或 DA03；不要重复 DOC02 文档写入或 DA02 Git 命令。无影响证据可复用须给出依据，不从 Hash 推导语义完成。

## 退出与阻断

所有适用验证有当前证据；独立性/检查结果/覆盖不足或任何 running/unknown 效果阻断 VR06。

## 重新核验

实现、修复、文档语义、Git metadata、环境或验收变化后失效受影响证据，补充当前检查。

## 规则来源

- [verification.md](../references/coding/layer-02-workflow-concepts/verification-and-repair/verification.md)
- [verification-epoch.md](../references/coding/layer-02-workflow-concepts/verification-and-repair/verification-epoch.md)
- [verification-independence.md](../references/coding/layer-02-workflow-concepts/verification-and-repair/verification-independence.md)
- [verification-reporting.md](../references/coding/layer-02-workflow-concepts/verification-and-repair/verification-reporting.md)
