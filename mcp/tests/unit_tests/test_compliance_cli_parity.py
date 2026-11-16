"""离线中文文档检查与 MCP 共用规则的回归。"""

from __future__ import annotations

import contextlib
import io
import runpy
import sys
from pathlib import Path

from token_io_decoupling_core.compliance_core import (
    document_link_issues,
    is_bilingual_document,
    layer01_section_issues,
    multilingual_mirror_issues,
)

REPO = Path(__file__).resolve().parents[3]
SCRIPTS = REPO / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


def _write(root: Path, relative: str, content: str) -> Path:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def test_chinese_layout_accepts_no_mirrors_and_rejects_old_suffix(tmp_path: Path):
    _write(tmp_path, "docs/skill/SKILL.md", "---\nname: example\n---\n中文指令。\n")
    checker = runpy.run_path(str(SCRIPTS / "check-multilingual-docs.py"))
    assert checker["main"](tmp_path) == 0
    _write(tmp_path, "docs/skill/SKILL_zh_cn.md", "旧中文镜像。\n")
    stderr = io.StringIO()
    with contextlib.redirect_stderr(stderr):
        assert checker["main"](tmp_path) == 1
    assert "仍存在旧语言副本" in stderr.getvalue()


def test_link_and_layer01_cli_helpers_match_the_shared_core(tmp_path: Path):
    source = "docs/skill/references/coding/layer-01-fundamental-concepts/a.md"
    target = "docs/skill/references/coding/layer-02-workflow-concepts/b.md"
    _write(tmp_path, source, "[非法向上链接](../layer-02-workflow-concepts/b.md)\n")
    _write(tmp_path, target, "中文目标。\n")
    script = runpy.run_path(str(SCRIPTS / "check-doc-layer-links.py"))
    expected = document_link_issues(
        {source: (tmp_path / source).read_text(), target: (tmp_path / target).read_text()}
    )
    stderr = io.StringIO()
    with contextlib.redirect_stderr(stderr):
        assert script["main"](tmp_path) == 1
    assert expected and all(issue in stderr.getvalue() for issue in expected)
    text = "## 通用规范\n只有一个章节。\n"
    path = _write(tmp_path, source, text)
    sections = runpy.run_path(str(SCRIPTS / "check-layer-01-sections.py"))
    assert sections["check_document"](path, tmp_path) == layer01_section_issues(source, text)


def test_runtime_never_requires_an_english_or_chinese_peer():
    for path in ("mcp/AGENTS.md", "mcp/CANDIDATE_COMPLIANCE.md", "docs/skill/SKILL.md"):
        assert not is_bilingual_document(path)
        assert multilingual_mirror_issues([path], lambda _: False) == []
