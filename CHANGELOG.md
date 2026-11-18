# 变更日志

## 未发布

### Pi Coding 工作流由 Hooks 驱动

让 Single-Agent 和 Multi-Agent 共用同一套推进逻辑。运行时读取路线 YAML 中按约定排列的七个阶段及主 Hook 绑定，按相应合同处理检查点、适用分支和额外触发条件。发布构建校验路线及检查点约定。

- Extension 按当前阶段、语义信号和宿主状态加载适用合同。Multi-Agent 选择 Root 执行时，记录子代理专属检查点为不适用，继续执行共用的 Slice、结果审阅与控制要求。见 [路线目录](docs/rules/coding-workflows/README.yaml) 和 [Hook 目录](docs/rules/hooks/README.yaml)。
- 宿主负责精确路径、Slice、子代理预算与职责、当前验证证据和未知效果等守卫。补证结束后回到原调用位置，保留模式、预算和历史效果。实质需求变化会使旧检查失效，并要求核对当前计划及其证据。见 [Extension 使用说明](docs/project/PI_EXTENSION.md)。
- 纯文档变更在 DOC05 取得适用的当前检查证据后可只更新文档验证维度。需要重验时回到对应写后位置。Git 写入限定在 DA02，内容与文档证据必须当前，已发生的 Git 效果在验收前按新状态检查。

对应改动涉及 [工作流实现](extensions/coding-workflow/)、[规则 Schema](docs/rules/reference.schema.json)、[Hook 模板](docs/rules/templates/hooks/hook-contract.yaml)、项目使用和维护文档，以及 [引擎回归测试](extension-tests/engine.test.mjs) 和 [Hook 回归测试](extension-tests/hooks.test.mjs)。
