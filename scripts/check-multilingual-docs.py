#!/usr/bin/env python3
"""检查中文单一权威文档布局；保留旧命令名以兼容调用入口。"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from markdown_discovery import discover_markdown

ROOT = Path(__file__).resolve().parents[1]


def main(root: Path | None = None) -> int:
    root = Path(root or ROOT).absolute()
    errors: list[str] = []
    for path in discover_markdown(root):
        text = path.read_text(encoding="utf-8")
        relative = path.relative_to(root)
        if path.name.endswith("_zh_cn.md") or relative.parts[:2] == ("docs", "zh-cn"):
            errors.append(f"仍存在旧语言副本：{relative}")
        if re.search(r"^\[English\].*\[简体中文\]", text, re.M):
            errors.append(f"仍存在语言切换：{relative}")
        if re.search(r"\]\([^)]*_zh_cn\.md(?:#[^)]*)?\)", text):
            errors.append(f"仍引用旧语言文件：{relative}")
        if not re.search(r"[\u4e00-\u9fff]", text):
            errors.append(f"缺少中文正文：{relative}")
        if "sed: --: No such file or directory" in text:
            errors.append(f"存在意外命令错误文本：{relative}")
    skill = root / "docs/skill/SKILL.md"
    if not skill.is_file() or not skill.read_text(encoding="utf-8").startswith("---\n"):
        errors.append("SKILL.md 缺少 YAML front matter")
    if errors:
        print("中文文档检查失败：\n" + "\n".join(errors), file=sys.stderr)
        return 1
    print("中文单一权威文档检查通过。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
