# 文档标准与维护规范

本文件负责当前仓库的文档语言、命名与维护要求。每条规则只维护一份中文源文件。

## 文件命名

- 维护的说明、指令和设计文档统一使用简体中文，保留既有不带语言后缀的文件名，例如 `README.md`、`SKILL.md`。
- 不创建带旧语言后缀的中文镜像，也不另建英文版本或语言目录。
- 技术术语、模型与 API 标识符、命令、配置键、代码示例和外部资料的原始名称无需强行翻译。
- 用户保存的非启用备份、历史测量数据和第三方原始材料不属于维护中的权威指令，不因本规范被自动改写。

## 内容与引用

- 每份文档只维护一份中文正文，不再提供语言切换链接。
- 本地 Markdown 链接必须指向实际存在的当前文件；移动文件时同步更新链接、代码中的资源路径、规则注册表和构建资源。
- Skill 入口使用标准 `SKILL.md` 和有效的 YAML front matter，按需引用其目录内的中文说明。
- 面向用户的元数据说明使用中文；程序字段与协议标识符保持其接口约定。
- 本规范不改变 MCP Tools 内部使用 OpenAI API 的执行方式，也不改变操作授权与安全边界。

## 参考规则 DSL

`docs/skill/references/` 下的参考文档统一通过 `docs/rules/references/` 中的 YAML 维护，覆盖 Coding 概念、检查点、共享协议、Multimodal 和导航页。Coding 路线在 `docs/rules/coding-workflows/` 下与 Hook 同级，例如 [单代理路线 YAML](../rules/coding-workflows/coding-single-agent.yaml) 对应 [单代理路线 Markdown](../skill/coding-workflows/coding-single-agent.md)。编译器检查相对路径，YAML 文件统一关联 [DSL Schema](../rules/reference.schema.json)。

### Skill 文档依赖顺序

`layer-01-fundamental-concepts` → `layer-02-workflow-concepts` → `layer-03-workflow-checkpoints` → `hooks` → `coding-workflows`

箭头从被依赖层指向使用方。跨层引用只指向当前位置左侧的目录。同层导航继续遵守各自的链接规则。编译器和 Markdown 链接检查共用这一顺序，按解析后的目标路径检查文档及目录链接。流程图别名和 Hook 执行片段引用也遵守该顺序。

`blocks` 是有序列表，每项以稳定 ID 为键。`section` 生成标题和下级块，`checkpoint` 生成编号条目，`route_step` 绑定当前阶段及 Hook。`markdown` 保留列表、表格和 Mermaid 等正文。需独立读取的参考规则章节用 `expose: true` 发布片段，独立正文块还需填写 `title`。路线图只描述主阶段间的必要顺序。条件分支、补证与恢复由对应 Hook 合同定义，路线链接到适用合同。Serena 在项目的 `language_servers` 启用 `yaml` 后，可按块 ID 定位检查点。

DSL 源文件之间使用相对 `.yaml` 链接。引用具体章节时使用块 ID，例如 `runtime-provider-support.yaml#subagent-models`。编译器验证目标文件及章节，再为阅读版生成相应的 `.md` 和 Markdown 标题锚点。Pi 将同一引用解析为 `coding-rule:`，按片段 ID 查询正文。`markdown_path` 字段指定阅读版的位置。

`npm ci` 和 `npm pack` 通过 `prepare` 生成 Skill；`npm test` 也会在测试前生成。只修改规则、Hook 或 Skill 入口时，可执行 `npm run build:skill` 单独重新生成。编译器从 `docs/rules/` 生成完整的 `docs/skill/`，包括 Markdown 阅读版和 Skill 注册元数据。该目录由 Git 忽略，`--check` 只读核对本地生成结果。Pi Extension 启动时解析原始 YAML 并建立指纹索引，按 ID 读取当前片段。[Pi Extension 使用说明](PI_EXTENSION.md)和[工作流架构](WORKFLOW_ARCHITECTURE.md)作为项目 Markdown 维护。

### Coding DSL 类型与模板

Coding DSL 用 `document_type` 声明用途。类型由 `docs/rules/` 下的路径和文件名确定。每个模板的 `document` 提供可复制的例子，`layouts` 定义允许的顶层块顺序，`block_rules` 定义块类型、必要的片段发布状态和子块类型。

| 类型 | 用途 | 标准块顺序 | 模板 |
| --- | --- | --- | --- |
| `directory-guide` | `README.yaml`，说明目录职责和阅读入口 | 参考目录按范围与边界或概览 → 入口 → 分类或所有者排列。路线目录按概览 → 入口 → 路线 → 分阶段 Hooks 排列 | [目录说明](../rules/templates/coding/directory-guide.yaml) |
| `fundamental-concept` | Layer-01，定义可跨工作流复用的通用规范 | 概览 → 通用规范 → Pi 优化指令 → 相关概念 | [基础概念](../rules/templates/coding/fundamental-concept.yaml) |
| `workflow-concept` | Layer-02，描述工作流动作、通过条件和边界 | 概览 → 动作 → 通过条件 → 边界 → 相关概念 | [工作流概念](../rules/templates/coding/workflow-concept.yaml) |
| `workflow-checkpoint` | Layer-03，定义具名检查点的输入、决策和返回 | 概览 → 触发与输入 → 决策与结果 → 失败边界 → 相关概念 | [检查点](../rules/templates/coding/workflow-checkpoint.yaml) |
| `workflow-route` | `coding-workflows/`，绑定七个阶段的 Hook | 概览 → 路线图 → 顺序检查清单 → 前置补证与恢复 → Mode 边界 → 按条件触发的 Hooks | [工作流路线](../rules/templates/coding/workflow-route.yaml) |

新建文档时，用相应类型替换下面的 `fundamental-concept`，将输出保存到相应目录。填写文档 ID、标题、`markdown_path` 和正文，并按文件所在目录调整首行 Schema 路径和相对链接。保留模板中标识章节用途的顶层块 ID，为新增子块填写稳定 ID。模板的首种布局适合作为新文档的起点，其他布局保留已有文档的结构。

```sh
uv run --locked --script scripts/compile-reference-dsl.py --template fundamental-concept
uv run --locked --script scripts/compile-reference-dsl.py --check-structure
```

结构检查会验证类型声明、章节顺序、块类型、必须发布的片段、路线阶段顺序和现有路线、模块的检查点 ID。正常导出和 `--check` 也执行这组检查，并继续核对引用和生成结果。

参考目录和路线目录以 `README.yaml` 为导航入口。参考目录的分类或所有者章节应各引用一次直属规则和子目录的 `README.yaml`。构建会清理这两处仍带原生成标记的旧 `INDEX.md`。

### 从流程图定位检查点

从仓库根目录运行以下命令。查询读取当前 YAML 源文件。将输出的 `relative_path` 和 `name_path` 分别传给 Serena `find_symbol` 的 `relative_path` 和 `name_path_pattern`，并将 `include_body` 设为 `true`，即可通过 YAML 后端读取对应节点。输出的 `line` 是编辑器中从 1 开始的行号，`--show` 可直接输出该块内容。

```sh
uv run --locked --script scripts/compile-reference-dsl.py --locate-checkpoint VR04
uv run --locked --script scripts/compile-reference-dsl.py --locate-checkpoint SM04
uv run --locked --script scripts/compile-reference-dsl.py --locate-checkpoint VR_HANDOFF --from hook-verification
uv run --locked --script scripts/compile-reference-dsl.py --locate-checkpoint 'route-entry#failure-boundary' --show
```

查询编号步骤时，脚本定位到定义它的 Hook 检查清单。路线步骤还返回 `hook_entry`，供继续查看当前阶段的触发条件。流程图中的跨文件别名由该文档的 `flowchart_references` 声明，值为相对 `.yaml#块ID`。例如 [验证 Hook](../rules/hooks/verification.yaml) 将 `VR_HANDOFF` 指向交接规则的 `actions`，查询时用 `--from hook-verification` 指定图。编译器校验图节点、目标文件和块。仅表示分支或结果的图节点会提示没有独立定义。

## Hook DSL

16 份执行合同和 Hooks 目录页维护在 `docs/rules/hooks/`，Markdown 阅读版保留在 `docs/skill/hooks/` 的原路径。

- [合同模板](../rules/templates/hooks/hook-contract.yaml) 按触发条件、输入与证据、执行要求、阶段路线图与有序检查点、输出与落点、退出与阻断、重新核验、规则来源排序。阶段路线图和检查点用于八份由路线绑定的合同。顶层块、执行子章节和检查点可以按稳定 ID 查询。
- [目录模板](../rules/templates/hooks/hook-directory.yaml) 定义导语、合同与明确触发、宿主回调、链接基准和维护检查的顺序。
- `activate_on` 声明阶段、语义信号或宿主状态对应的合同。Agent 根据路线、实际动作及证据读取阶段合同，扩展根据实际会话状态和 `coding_checkpoint signal` 提示补充合同。`applicability: optional` 标记可凭证据判断不适用的事项，`applicability: sub_agent` 限定子代理分支。用 `npm run check:hooks` 检查运行时索引。
- 导航引用使用相对 `.yaml#块ID`，导出时转成 Markdown 路径和标题锚点。执行要求中的 `rule_include` 用来读取所引用的底层参考规则片段。Pi 注入主路线和已触发的合同，路线图与来源表随阅读版发布。使用 `coding-rule:hook-entry#ER03` 等 ID 可定向查询检查点。 [入口合同示例](../rules/hooks/entry.yaml)
- 修改规则来源后先编译，再由 `node scripts/check-pi-hooks.mjs --write-coverage` 从合同的来源表刷新 [YAML 来源对照](../rules/hooks/SOURCE_COVERAGE.yaml)。再次执行 `npm run build:skill` 生成 [Markdown 来源对照](../skill/hooks/SOURCE_COVERAGE.md)。阶段绑定可在[路线目录](../rules/coding-workflows/README.yaml)的“分阶段 Hooks”章节查阅。日常检查用 `npm run check:hooks` 校验来源对照、链接与注入场景。

```sh
uv run --locked --script scripts/compile-reference-dsl.py --template hook-contract
uv run --locked --script scripts/compile-reference-dsl.py --template hook-directory
uv run --locked --script scripts/compile-reference-dsl.py --check-structure
```

## 验证

运行以下文档检查，并按修改范围运行对应测试：

```sh
npm run build:skill
uv run --locked --script scripts/compile-reference-dsl.py --check
python3 scripts/check-doc-layer-links.py
python3 scripts/check-layer-01-sections.py
python3 scripts/check-layer-02-04-provider-neutrality.py
python3 scripts/check-layer-04-workflow-maps.py
python3 -m unittest discover -s tests
git diff --check
```

文档层级、所有权、模块顺序、必要证据和工作流返回边界仍须保留。
