#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["jsonschema==4.26.0", "ruamel.yaml==0.19.1"]
# ///
"""从有序规则 DSL 导出可浏览的 Markdown 和 Pi 按 ID 读取的片段。"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, ValidationError
from ruamel.yaml import YAML, YAMLError
from ruamel.yaml.tokens import AliasToken, AnchorToken

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/rules"
SKILL = ROOT / "docs/skill"
DATA = SKILL / "reference-data"


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def read_rule(path: Path, validator: Draft202012Validator) -> dict:
    yaml = YAML(typ="safe", pure=True)
    text = path.read_text(encoding="utf-8")
    if any(isinstance(token, (AliasToken, AnchorToken)) for token in yaml.scan(text)):
        raise ValueError(f"{path.name} 不允许 YAML 锚点或别名")
    document = yaml.load(text)
    try:
        validator.validate(document)
    except ValidationError as error:
        raise ValueError(f"{path.name} {error.json_path}: {error.message}") from error
    if document["id"] != path.stem:
        raise ValueError(f"{path.name} 的文档 ID 必须与文件名一致")
    return document


def render_blocks(
    blocks: list[dict], level: int, seen: set[str], fragments: dict[str, tuple[str, str, str]]
) -> str:
    parts = []
    previous = None
    number = 0
    for entry in blocks:
        block_id, block = next(iter(entry.items()))
        if block_id in seen:
            raise ValueError(f"重复块 ID：{block_id}")
        seen.add(block_id)
        kind = block["kind"]
        if parts:
            parts.append("\n" if previous == kind == "checkpoint" else "\n\n")
        if kind == "section":
            if level > 6:
                raise ValueError(f"标题层级超过 Markdown 上限：{block_id}")
            body = render_blocks(block["blocks"], level + 1, seen, fragments)
            parts.append(f"{'#' * level} {block['title']}\n\n{body}")
        else:
            body = block["text"].rstrip("\n")
            if not body.strip():
                raise ValueError(f"正文为空：{block_id}")
            if kind == "checkpoint":
                number = number + 1 if previous == kind else 1
                indent = " " * (len(str(number)) + 2)
                first, *rest = body.split("\n")
                parts.append(f"{number}. **{block_id} — {block['title']}** {first}")
                parts.extend(f"\n{indent}{line}" if line else "\n" for line in rest)
            else:
                parts.append(body)
        if kind == "checkpoint" or block.get("expose"):
            fragments[block_id] = (kind, block["title"], body + "\n")
        previous = kind
    return "".join(parts)


def compile_rules() -> dict[Path, str]:
    schema = json.loads((SOURCE / "reference.schema.json").read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    outputs: dict[Path, str] = {}
    documents = []
    for source_path in sorted(SOURCE.glob("*.yaml")):
        document = read_rule(source_path, validator)
        document_id = document["id"]
        markdown_path = SKILL / document["markdown_path"]
        if markdown_path in outputs:
            raise ValueError(f"多个 DSL 指向同一 Markdown：{markdown_path}")
        fragments: dict[str, tuple[str, str, str]] = {}
        body = render_blocks(document["blocks"], 2, set(), fragments)
        provenance = f"<!-- 由 docs/rules/{source_path.name} 生成。请在 DSL 中维护正文。 -->"
        markdown = f"# {document['title']}\n\n{provenance}\n\n\n{body}\n"
        outputs[markdown_path] = markdown
        manifest_fragments = []
        for fragment_id, (kind, title, content) in fragments.items():
            outputs[DATA / "fragments" / document_id / f"{fragment_id}.txt"] = content
            manifest_fragments.append(dict(id=fragment_id, kind=kind, title=title, sha256=sha256(content)))
        documents.append(dict(id=document_id, path=document["markdown_path"], sha256=sha256(markdown), fragments=manifest_fragments))
    if not documents:
        raise ValueError("没有可编译的规则 DSL")
    outputs[DATA / "manifest.json"] = json.dumps(dict(schema_version=1, documents=documents), ensure_ascii=False, indent=2) + "\n"
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="只检查已生成的文件是否与 DSL 一致")
    args = parser.parse_args()
    try:
        outputs = compile_rules()
        for path in outputs:
            if path.resolve() != path:
                raise ValueError(f"生成目标不允许符号链接：{path.relative_to(ROOT)}")
        outdated = [path for path, body in outputs.items() if not path.is_file() or path.read_bytes() != body.encode("utf-8")]
        unexpected = set(DATA.glob("fragments/*/*.txt")) - outputs.keys()
        if unexpected or (args.check and outdated):
            for path in sorted(unexpected):
                print(f"过时的规则片段 {path.relative_to(ROOT)}", file=sys.stderr)
            if args.check:
                for path in outdated:
                    print(f"请重新生成 {path.relative_to(ROOT)}", file=sys.stderr)
            return 1
        for path in outdated:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(outputs[path].encode("utf-8"))
    except (OSError, YAMLError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1
    print(f"规则 DSL {'校验通过' if args.check else '导出完成'}，共 {len(outputs)} 个产物。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
