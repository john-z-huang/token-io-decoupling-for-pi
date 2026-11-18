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
import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, ValidationError
from ruamel.yaml import YAML, YAMLError
from ruamel.yaml.tokens import AliasToken, AnchorToken

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/rules"
SKILL = ROOT / "docs/skill"
DATA = SKILL / "reference-data"
NUMBERED_BLOCKS = {"checkpoint", "route_step"}
HOOK_NAME = re.compile(r"[a-z][a-z0-9-]*")
RULE_INCLUDE = re.compile(r"^<!-- rule:([a-z][a-z0-9-]*)#([A-Za-z][A-Za-z0-9-]*) -->$")
ROUTE_IDS = ("coding-single-agent", "coding-multi-agent")


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def source_bytes(path: Path) -> bytes:
    if path.resolve() != path:
        raise ValueError(f"规则源不允许符号链接：{path.relative_to(ROOT)}")
    return path.read_bytes()


def read_rule(path: Path, text: str, validator: Draft202012Validator) -> dict:
    yaml = YAML(typ="safe", pure=True)
    if any(isinstance(token, (AliasToken, AnchorToken)) for token in yaml.scan(text)):
        raise ValueError(f"{path.name} 不允许 YAML 锚点或别名")
    document = yaml.load(text)
    try:
        validator.validate(document)
    except ValidationError as error:
        raise ValueError(f"{path.name} {error.json_path}: {error.message}") from error
    expected = path.relative_to(SOURCE).with_suffix(".md").as_posix()
    if document["markdown_path"] != expected:
        raise ValueError(f"{path.relative_to(ROOT)} 的 Markdown 路径应为 {expected}")
    return document


def render_blocks(
    blocks: list[dict], level: int, seen: set[str], fragments: dict[str, dict[str, str]]
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
            parts.append("\n" if previous == kind and kind in NUMBERED_BLOCKS else "\n\n")
        if kind == "section":
            if level > 6:
                raise ValueError(f"标题层级超过 Markdown 上限：{block_id}")
            body = render_blocks(block["blocks"], level + 1, seen, fragments)
            parts.append(f"{'#' * level} {block['title']}\n\n{body}")
        else:
            body = block["text"].rstrip("\n")
            if not body.strip():
                raise ValueError(f"正文为空：{block_id}")
            if kind in NUMBERED_BLOCKS:
                number = number + 1 if previous == kind else 1
                indent = " " * (len(str(number)) + 2)
                first, *rest = body.split("\n")
                parts.append(f"{number}. **{block_id} — {block['title']}** {first}")
                parts.extend(f"\n{indent}{line}" if line else "\n" for line in rest)
            else:
                parts.append(body)
        if kind in NUMBERED_BLOCKS or block.get("expose"):
            fragment = dict(id=block_id, kind=kind, title=block["title"], content=body + "\n")
            if kind == "route_step":
                module = block["module"]
                if f"](modules/{module}.md)" not in body:
                    raise ValueError(f"路线项 {block_id} 的模块与 Markdown 链接不一致：{module}")
                fragment.update(phase=block["phase"], module=module)
            fragments[block_id] = fragment
        previous = kind
    return "".join(parts)


def compile_hooks(fragment_ids: dict[str, set[str]], outputs: dict[Path, str]) -> dict[str, str]:
    hooks = {}
    for path in sorted((SKILL / "hooks").glob("*.md")):
        if not HOOK_NAME.fullmatch(path.stem):
            continue
        content = source_bytes(path).decode("utf-8")
        titles = ("触发条件", "执行要求", "退出与阻断", "重新核验", "规则来源")
        positions = [content.find(f"\n## {title}\n") for title in titles]
        if "\0" in content or -1 in positions or positions != sorted(positions):
            raise ValueError(f"Hook 合同章节缺失、次序错误或包含 NUL：{path.name}")
        body = content[:positions[-1]].rstrip() + "\n"
        sources = content[positions[-1]:]
        if "<!-- rule:" in sources:
            raise ValueError(f"规则引用须放在 Hook 执行正文：{path.name}")
        for line in body.splitlines():
            if "<!-- rule:" not in line:
                continue
            include = RULE_INCLUDE.fullmatch(line)
            if not include:
                raise ValueError(f"无效的 Hook 规则引用：{path.name}: {line}")
            document, fragment = include.groups()
            targets = ROUTE_IDS if document == "current-route" else (document,)
            for target in targets:
                if fragment not in fragment_ids.get(target, set()):
                    raise ValueError(f"Hook 引用缺少 DSL 片段：{path.name} -> {target}#{fragment}")
        outputs[DATA / "hooks" / f"{path.stem}.txt"] = body
        hooks[path.stem] = sha256(body)
    return hooks


def legacy_rule_digest(outputs: dict[Path, str]) -> str:
    # 尚未迁移的 owner 仍参与规则失效判断，在构建时记录而不由 Pi 扫描。
    digest = hashlib.sha256()
    for path in sorted(SKILL.rglob("*.md")):
        relative = path.relative_to(SKILL)
        if relative.parts[0] == "hooks" or path in outputs:
            continue
        digest.update(relative.as_posix().encode("utf-8") + b"\0")
        digest.update(hashlib.sha256(source_bytes(path)).digest())
    return digest.hexdigest()


def compile_rules() -> dict[Path, str]:
    schema = json.loads((SOURCE / "reference.schema.json").read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    outputs: dict[Path, str] = {}
    documents = []
    fragment_ids: dict[str, set[str]] = {}
    for source_path in sorted(SOURCE.rglob("*.yaml")):
        source = source_bytes(source_path)
        document = read_rule(source_path, source.decode("utf-8"), validator)
        document_id = document["id"]
        if document_id in fragment_ids or document_id == "current-route":
            raise ValueError(f"重复或保留的文档 ID：{document_id}")
        markdown_path = SKILL / document["markdown_path"]
        fragments: dict[str, dict[str, str]] = {}
        body = render_blocks(document["blocks"], 2, set(), fragments)
        if "<!-- rule:" in body:
            raise ValueError(f"DSL 规则正文不包含 Hook 执行引用：{source_path.relative_to(ROOT)}")
        provenance = f"<!-- 由 {source_path.relative_to(ROOT).as_posix()} 生成。请在 DSL 中维护正文。 -->"
        markdown = f"# {document['title']}\n\n{provenance}\n\n\n{body}\n"
        outputs[markdown_path] = markdown
        manifest_fragments = []
        for fragment_id, fragment in fragments.items():
            content = fragment.pop("content")
            outputs[DATA / "fragments" / document_id / f"{fragment_id}.txt"] = content
            manifest_fragments.append({**fragment, "sha256": sha256(content)})
        fragment_ids[document_id] = set(fragments)
        documents.append(dict(
            id=document_id, path=document["markdown_path"], title=document["title"],
            source_sha256=hashlib.sha256(source).hexdigest(), fragments=manifest_fragments,
        ))
    if not documents:
        raise ValueError("没有可编译的规则 DSL")
    manifest = dict(schema_version=3, documents=documents, hooks=compile_hooks(fragment_ids, outputs), legacy_rule_sha256=legacy_rule_digest(outputs))
    outputs[DATA / "manifest.json"] = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
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
        assets = set(DATA.glob("fragments/*/*.txt")) | set(DATA.glob("hooks/*.txt"))
        unexpected = assets - outputs.keys()
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
