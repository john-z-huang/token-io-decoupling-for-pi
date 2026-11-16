#!/usr/bin/env python3
"""使用共享校验核心检查 Pi 指令的 Layer-01 模块。"""

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
    """CLI 与 MCP 使用同一份 Pi 文档结构合同。"""
    return _COMPLIANCE_CORE.layer01_section_issues(path, content)

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
