# 完整 Coding 路线

<!-- 由 docs/rules/coding-workflows/README.yaml 生成。请在 DSL 中维护正文。 -->


Layer-04 维护 Single-Agent 和 Multi-Agent 两条路线。路线负责七个阶段的 Hook 绑定、跨阶段顺序、调用方位置和 epoch 变化后的回返。各阶段的执行合同、清单和图由对应 Hook 维护。

## 入口

从[路线索引](INDEX.md)选择获授权路线，在相应阶段按需读取绑定的 Hook。
