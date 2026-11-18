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
import posixpath
import re
import sys
import unicodedata
from collections.abc import Callable, Iterator
from pathlib import Path
from urllib.parse import unquote

from jsonschema import Draft202012Validator, ValidationError
from ruamel.yaml import YAML, YAMLError
from ruamel.yaml.tokens import AliasToken, AnchorToken

from coding_dsl_templates import DOCUMENT_TYPES, document_type, load_templates, validate_coding_document
from workflow_checkpoint_lookup import NUMBERED_BLOCKS, check_flowchart_references, locate_checkpoint

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/rules"
REFERENCES = SOURCE / "references"
CODING = REFERENCES / "coding"
TEMPLATES = SOURCE / "templates/coding"
SKILL = ROOT / "docs/skill"
DATA = SKILL / "reference-data"
HOOK_NAME = re.compile(r"[a-z][a-z0-9-]*")
RULE_INCLUDE = re.compile(r"^<!-- rule:([a-z][a-z0-9-]*)#([A-Za-z][A-Za-z0-9-]*) -->$")
ROUTE_IDS = ("coding-single-agent", "coding-multi-agent")
FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
INLINE_LINK = re.compile(r"(`+)[^\n]*?\1|(!?\[[^\]\n]*\]\()(<[^>\n]+>|[^\s)]+)(?=[ \t]*(?:\)|[\"']))")
REFERENCE_LINK = re.compile(r"^( {0,3}\[[^\]\n]+\]:[ \t]*)(<[^>\n]+>|[^\s]+)(?=[ \t]|$)")
EXTERNAL_LINK = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//)", re.I)


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


def heading_anchor(title: str, counts: dict[str, int]) -> str:
    label = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", title)
    label = re.sub(r"<[^>]*>", "", label).lower()
    base = "".join(char for char in label if char in "_-" or char.isspace() or unicodedata.category(char)[0] in "LNM")
    base = base.replace(" ", "-")
    count = counts.get(base, 0)
    counts[base] = count + 1
    return f"{base}-{count}" if count else base


def render_blocks(
    blocks: list[dict], level: int, seen: set[str], fragments: dict[str, dict[str, str]], heading_counts: dict[str, int]
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
            default_gap = 0 if previous == kind and kind in NUMBERED_BLOCKS else 1
            parts.append("\n" * (1 + block.get("blank_lines_before", default_gap)))
        fragment = None
        if kind in NUMBERED_BLOCKS or block.get("expose"):
            fragment = dict(id=block_id, kind=kind, title=block["title"])
            fragments[block_id] = fragment
        if kind == "section":
            if level > 6:
                raise ValueError(f"标题层级超过 Markdown 上限：{block_id}")
            anchor = heading_anchor(block["title"], heading_counts)
            if fragment is not None:
                fragment["anchor"] = anchor
            body = render_blocks(block["blocks"], level + 1, seen, fragments, heading_counts)
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
        if fragment is not None:
            fragment["content"] = body + "\n"
            if kind == "route_step":
                module = block["module"]
                if f"](modules/{module}.yaml)" not in body:
                    raise ValueError(f"路线项 {block_id} 的模块与 DSL 链接不一致：{module}")
                fragment.update(phase=block["phase"], module=module)
        previous = kind
    return "".join(parts)


def map_markdown_links(markdown: str, rewrite: Callable[[str], str]) -> str:
    def destination(prefix: str, href: str) -> str:
        if href.startswith("<"):
            return prefix + "<" + rewrite(href[1:-1]) + ">"
        return prefix + rewrite(href)

    lines = []
    fence = ""
    for line in markdown.split("\n"):
        marker = FENCE.match(line)
        if fence:
            if marker and marker[1][0] == fence[0] and len(marker[1]) >= len(fence) and not line[marker.end():].strip():
                fence = ""
        elif marker:
            fence = marker[1]
        else:
            line = INLINE_LINK.sub(lambda match: match[0] if match[1] else destination(match[2], match[3]), line)
            line = REFERENCE_LINK.sub(lambda match: destination(match[1], match[2]), line)
        lines.append(line)
    return "\n".join(lines)


def render_reference_links(path: str, markdown: str, documents: dict[str, dict]) -> str:
    def rewrite(href: str) -> str:
        if EXTERNAL_LINK.match(href):
            return href
        before_hash, has_fragment, fragment = href.partition("#")
        target, query_mark, query = before_hash.partition("?")
        resolved = posixpath.normpath(posixpath.join(posixpath.dirname(path), unquote(target)))
        if resolved.startswith("references/") and resolved.endswith(".md"):
            raise ValueError(f"DSL 内部引用须指向 YAML：{path} -> {href}")
        if not target.endswith(".yaml"):
            return href
        owner = documents.get(resolved.removesuffix(".yaml") + ".md")
        if not owner:
            raise ValueError(f"DSL 引用目标不存在：{path} -> {href}")
        if has_fragment:
            block = next((item for item in owner["fragments"] if item["id"] == unquote(fragment)), None)
            if not block or not block.get("anchor"):
                raise ValueError(f"DSL 引用缺少可导出的章节：{path} -> {href}")
            fragment = block["anchor"]
        return target.removesuffix(".yaml") + ".md" + query_mark + query + has_fragment + fragment

    return map_markdown_links(markdown, rewrite)


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
    # Skill 入口等手写规则仍参与失效判断，在构建时记录而不由 Pi 扫描。
    digest = hashlib.sha256()
    for path in sorted(SKILL.rglob("*.md")):
        relative = path.relative_to(SKILL)
        if relative.parts[0] == "hooks" or path in outputs:
            continue
        digest.update(relative.as_posix().encode("utf-8") + b"\0")
        digest.update(hashlib.sha256(source_bytes(path)).digest())
    return digest.hexdigest()


def rule_validator() -> Draft202012Validator:
    schema = json.loads((SOURCE / "reference.schema.json").read_text(encoding="utf-8"))
    return Draft202012Validator(schema)


def read_rules(directory: Path) -> Iterator[tuple[Path, bytes, dict]]:
    validator = rule_validator()
    templates = load_templates(TEMPLATES, validator)
    ids = {"current-route"}
    coding_documents = {}
    for path in sorted(directory.rglob("*.yaml")):
        source = source_bytes(path)
        document = read_rule(path, source.decode("utf-8"), validator)
        if document["id"] in ids:
            raise ValueError(f"重复或保留的文档 ID：{path.relative_to(ROOT)}#{document['id']}")
        ids.add(document["id"])
        if path.is_relative_to(CODING):
            relative = path.relative_to(CODING)
            validate_coding_document(relative, document, templates[document_type(relative)])
            coding_documents[path] = document
        yield path, source, document
    check_flowchart_references(coding_documents)


def compile_rules() -> dict[Path, str]:
    outputs: dict[Path, str] = {}
    documents = []
    fragment_ids: dict[str, set[str]] = {}
    for source_path, source, document in read_rules(REFERENCES):
        document_id = document["id"]
        markdown_path = SKILL / document["markdown_path"]
        fragments: dict[str, dict[str, str]] = {}
        heading_counts: dict[str, int] = {}
        heading_anchor(document["title"], heading_counts)
        body = render_blocks(document["blocks"], 2, set(), fragments, heading_counts)
        if "<!-- rule:" in body:
            raise ValueError(f"DSL 规则正文不包含 Hook 执行引用：{source_path.relative_to(ROOT)}")
        provenance = f"<!-- 由 {source_path.relative_to(ROOT).as_posix()} 生成。请在 DSL 中维护正文。 -->"
        title_gap = "\n" * document.get("blank_lines_after_title", 2)
        markdown = f"# {document['title']}\n\n{provenance}\n{title_gap}{body}\n"
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
    for path in sorted((SKILL / "references").rglob("*.md")):
        if path not in outputs:
            raise ValueError(f"参考文档缺少对应的 YAML 源：{path.relative_to(SKILL)}")
    by_path = {document["path"]: document for document in documents}
    for path in by_path:
        target = SKILL / path
        outputs[target] = render_reference_links(path, outputs[target], by_path)
    manifest = dict(
        schema_version=4, documents=documents, hooks=compile_hooks(fragment_ids, outputs),
        legacy_rule_sha256=legacy_rule_digest(outputs),
    )
    outputs[DATA / "manifest.json"] = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="只检查已生成的文件是否与 DSL 一致")
    mode.add_argument("--check-structure", action="store_true", help="按模板检查 Coding DSL 结构")
    mode.add_argument("--template", choices=DOCUMENT_TYPES, help="输出指定类型的 YAML 示例")
    mode.add_argument("--locate-checkpoint", metavar="ID", help="定位检查点 ID 或文档ID#块ID")
    parser.add_argument("--from", dest="origin", metavar="文档ID", help="在指定流程图中定位节点")
    parser.add_argument("--show", action="store_true", help="定位时同时输出对应的 YAML 块内容")
    args = parser.parse_args()
    if args.locate_checkpoint is None and (args.origin or args.show):
        parser.error("--from 和 --show 须与 --locate-checkpoint 一起使用")
    if args.origin and "#" in args.locate_checkpoint:
        parser.error("使用 --from 时请指定流程图节点 ID")
    try:
        if args.locate_checkpoint is not None:
            location = locate_checkpoint(ROOT, CODING, args.locate_checkpoint, args.origin, args.show)
            print(json.dumps(location, ensure_ascii=False, indent=2))
            return 0
        if args.template:
            templates = load_templates(TEMPLATES, rule_validator())
            sample = templates[args.template]["document"]
            relative = Path(sample["markdown_path"])
            print(f"# yaml-language-server: $schema={'../' * len(relative.parent.parts)}reference.schema.json")
            yaml = YAML(typ="rt")
            yaml.indent(mapping=2, sequence=4, offset=2)
            yaml.width = 120
            yaml.dump(sample, sys.stdout)
            return 0
        if args.check_structure:
            count = 0
            for _, _, document in read_rules(CODING):
                render_blocks(document["blocks"], 2, set(), {}, {})
                count += 1
            if not count:
                raise ValueError("没有可校验的 Coding DSL")
            print(f"Coding DSL 结构校验通过，共 {count} 份文档。")
            return 0
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
    except (OSError, ValidationError, YAMLError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1
    print(f"规则 DSL {'校验通过' if args.check else '导出完成'}，共 {len(outputs)} 个产物。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
