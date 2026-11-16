# 文档标准与维护规范

本文件负责当前仓库的文档语言、命名与维护要求。中文文档是唯一权威来源，不再维护英文副本或中英文镜像。

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

## 验证

运行以下文档检查，并按修改范围运行对应测试：

```sh
python3 scripts/check-doc-layer-links.py
python3 scripts/check-layer-01-sections.py
python3 scripts/check-layer-02-04-provider-neutrality.py
python3 scripts/check-layer-04-workflow-maps.py
python3 -m unittest discover -s tests
git diff --check
```

文档层级、所有权、模块顺序、必要证据和工作流返回边界仍须保留。
