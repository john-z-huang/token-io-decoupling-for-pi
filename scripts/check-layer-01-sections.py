#!/usr/bin/env python3
"""检查 Pi 指令的 Layer-01 模块；与尚未迁移的 Server 校验契约分离。"""

from __future__ import annotations

import argparse
from pathlib import Path
from runpy import run_path

_COMPLIANCE_CORE = run_path(
    str(Path(__file__).resolve().with_name("compliance_core_loader.py"))
)["load_compliance_core"]()

LAYER_01 = Path("docs/skill/references/coding/layer-01-fundamental-concepts")
HEADINGS = ("通用规范", "Pi Coding Agent 优化指令")
NAVIGATION = "相关概念"
top_level_sections = _COMPLIANCE_CORE.top_level_sections


def layer01_section_issues(path: str, content: str) -> list[str]:
    """Validate authored Pi owners without changing the MCP Server's contract."""
    sections = top_level_sections(content)
    errors: list[str] = []
    expected = (*HEADINGS, NAVIGATION)
    found = [heading for _line, heading, _offset in sections]
    if found != list(expected):
        errors.append(f"{path}: 二级标题必须唯一且按序为 " + " → ".join(expected))
    for index, (line, heading, offset) in enumerate(sections):
        start = content.find("\n", offset)
        start = len(content) if start < 0 else start + 1
        end = sections[index + 1][2] if index + 1 < len(sections) else len(content)
        if heading in expected and not content[start:end].strip():
            errors.append(f"{path}:{line}: 模块 `## {heading}` 为空")
    return errors


def check_document(path: Path, root: Path) -> list[str]:
    content = path.read_text(encoding="utf-8")
    return layer01_section_issues(path.relative_to(root).as_posix(), content)


def is_navigation_file(path: Path) -> bool:
    """Navigation pages are validated separately and are never Layer-01 owners."""
    return path.name in {"README.md", "INDEX.md"}


def discover_owner_documents(directory: Path) -> list[Path]:
    """Recursively discover content owners while excluding explicit navigation files."""
    return sorted(path for path in directory.rglob("*.md") if not is_navigation_file(path))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = args.root.resolve()
    directory = root / LAYER_01
    if not directory.is_dir():
        print(f"缺少 Layer-01 目录: {directory}")
        return 1
    documents = discover_owner_documents(directory)
    if not documents:
        print(f"Layer-01 目录没有 Markdown 文档: {directory}")
        return 1
    errors = [error for path in documents for error in check_document(path, root)]
    if errors:
        print("Layer-01 模块结构检查未通过:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Layer-01 模块结构检查通过（{len(documents)} 份 Markdown 文档）。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
