# 文档标准与维护规范

维护中的文档使用简体中文，保留现有文件名。技术术语、字段名和命令沿用原写法。本地链接指向实际存在的文件或目录，移动源文件时同步更新使用方。历史快照随原始内容保存，默认构建、安装与验证都跳过 `archive/`。

## 规则源与生成产物

| 源文件 | 内容 |
| --- | --- |
| [Skill 入口](../rules/SKILL.yaml) | 任务编排范围、选路和按需阅读入口 |
| [工作流目录](../rules/workflows/README.yaml) | 单代理与多代理路线、各阶段的 Hook |
| [Hook 目录](../rules/hooks/README.yaml) | 触发条件、输入与证据、执行和交接要求 |
| [编排参考](../rules/references/) | 子代理规划、复用、替换和能力核验 |
| [子代理角色](../agents/) | 角色职责、派发条件和预期结果 |

`scripts/compile-reference-dsl.py` 从源文件生成 `skill/` 中的 Skill 入口和规则阅读版，并把角色描述一并发布。修改入口、路线和 Hook 时编辑 YAML，修改角色时编辑 `agents/` 下的 Markdown。生成目录由 Git 忽略。发布到本地管理目录见[安装与更新](../INSTALL.md)。

YAML 使用[规则 Schema](../rules/reference.schema.json)。`markdown_path` 指定输出位置，`blocks` 中的稳定 ID 用于引用和检查点查找。源规则使用相对 `.yaml` 路径和可选的 `#块ID`。编译器核对目标文档及片段，并生成相对的 Markdown 链接和标题锚点。

路线描述入场、规划、执行、验证和交付的顺序，以及必要的返回位置。Hook 描述适用动作的触发条件、所需证据、执行要求、交接与重新核验条件。跨文档的流程图节点与执行片段继续使用具名引用。

## 修改与验证

从仓库根目录运行。新增规则可先用 `--template` 查看模板。查询结果包含源文件位置和块 ID。

```bash
/bin/bash -c 'uv run --locked --script scripts/compile-reference-dsl.py --template workflow-route'
/bin/bash -c 'uv run --locked --script scripts/compile-reference-dsl.py --template hook-contract'
/bin/bash -c 'uv run --locked --script scripts/compile-reference-dsl.py --locate-checkpoint MM03 --show'
```

结构检查、生成结果检查和文档链接检查分别运行。

```bash
/bin/bash -c 'uv run --locked --script scripts/compile-reference-dsl.py --check-structure'
/bin/bash -c 'uv run --locked --script scripts/compile-reference-dsl.py'
/bin/bash -c 'uv run --locked --script scripts/compile-reference-dsl.py --check'
/bin/bash -c 'uv run --no-project -- python scripts/check-doc-layer-links.py'
/bin/bash -c 'uv run --no-project --with jsonschema==4.26.0 --with ruamel.yaml==0.19.1 -- python -m unittest discover -s tests'
/bin/bash -c 'git diff --check'
```

修改编排规则时，用与改动对应的场景核对语义。例如，比较明确禁止委派、简单任务和适合委派的任务如何选路。修改委派规则时，同时检查已有角色实例的复用、替换条件和推理强度限制。修改发布内容时，在隔离临时目录验证安装和更新。分别记录检查结果和实际验证过的行为。
