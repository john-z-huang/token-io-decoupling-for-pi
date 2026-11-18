import { createHash } from "node:crypto";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { isAlias, isNode, parseDocument, visit } from "yaml";

type MarkdownBlock = { kind: "markdown"; text: string; title?: string; expose: boolean };
type Applicability = "optional" | "sub_agent";
type CheckpointBlock = { kind: "checkpoint"; text: string; title: string; applicability?: Applicability };
type RouteBlock = { kind: "route_step"; text: string; title: string; phase: string; hook: string };
type SectionBlock = { kind: "section"; title: string; children: Entry[]; expose?: boolean; gap?: number };
type IncludeBlock = { kind: "rule_include"; document: string; fragment: string };
type Block = MarkdownBlock | CheckpointBlock | RouteBlock | SectionBlock | IncludeBlock;
type Entry = { id: string; block: Block };
type Fragment = { id: string; title: string } & (
  | { kind: "checkpoint"; applicability?: Applicability }
  | { kind: "markdown" }
  | { kind: "section"; anchor: string }
  | { kind: "route_step"; phase: string; hook: string }
);
interface ReferenceDocument {
  id: string;
  path: string;
  title: string;
  fragments: Fragment[];
  sectionIds: Map<string, string>;
}

const DOCUMENT_ID = /^[a-z][a-z0-9-]*$/;
const BLOCK_ID = /^[A-Za-z][A-Za-z0-9-]*$/;
const sha256 = (body: Buffer) => createHash("sha256").update(body).digest("hex");

export function headingSlug(title: string): string {
  return title
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "")
    .replace(/ /g, "-");
}

function mapping(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`DSL 应为映射：${path}`);
  return value as Record<string, unknown>;
}
function string(value: unknown, path: string, pattern?: RegExp): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.includes("\0") ||
    (pattern && !pattern.test(value))
  ) {
    throw new Error(`DSL 字段无效：${path}`);
  }
  return value;
}
function gap(value: unknown, path: string, minimum: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum)
    throw new Error(`DSL 空行数无效：${path}`);
  return value;
}

function readEntries(value: unknown, path: string, seen = new Set<string>()): Entry[] {
  if (!Array.isArray(value) || !value.length) throw new Error(`DSL 块列表为空或无效：${path}`);
  return value.map((item) => {
    const entries = Object.entries(mapping(item, path));
    if (entries.length !== 1) throw new Error(`DSL 块须有一个 ID：${path}`);
    const [id, raw] = entries[0];
    const key = `${path}#${id}`;
    if (!BLOCK_ID.test(id) || seen.has(id)) throw new Error(`DSL 块 ID 无效或重复：${key}`);
    seen.add(id);
    const data = mapping(raw, key);
    if (data.expose !== undefined && typeof data.expose !== "boolean")
      throw new Error(`DSL expose 无效：${key}`);
    let block: Block;
    switch (data.kind) {
      case "section":
        block = {
          kind: data.kind,
          title: string(data.title, key, /^[^\r\n]+$/),
          children: readEntries(data.blocks, path, seen),
          expose: data.expose === true,
          gap: gap(data.blank_lines_before, key, 0),
        };
        break;
      case "markdown":
        block = {
          kind: data.kind,
          text: string(data.text, key),
          expose: data.expose === true,
          title: data.expose || data.title !== undefined ? string(data.title, key, /^[^\r\n]+$/) : undefined,
        };
        break;
      case "checkpoint": {
        const applicability = data.applicability;
        if (applicability !== undefined && applicability !== "optional" && applicability !== "sub_agent") {
          throw new Error(`检查点适用条件无效：${key}`);
        }
        block = {
          kind: data.kind,
          text: string(data.text, key),
          title: string(data.title, key, /^[^\r\n]+$/),
          applicability,
        };
        break;
      }
      case "route_step": {
        const text = string(data.text, key);
        const hook = string(data.hook, key, DOCUMENT_ID);
        if (!text.includes(`](../hooks/${hook}.yaml)`))
          throw new Error(`路线契约变化，Hook 与 DSL 链接不一致：${key}`);
        block = {
          kind: data.kind,
          text,
          title: string(data.title, key, /^[^\r\n]+$/),
          phase: string(data.phase, key, DOCUMENT_ID),
          hook,
        };
        break;
      }
      case "rule_include":
        block = {
          kind: data.kind,
          document: string(data.document, key, DOCUMENT_ID),
          fragment: string(data.fragment, key, BLOCK_ID),
        };
        break;
      default:
        throw new Error(`DSL 块类型无效：${key}`);
    }
    return { id, block };
  });
}

function render(entries: Entry[], level: number): string {
  let result = "",
    previous: Block["kind"] | undefined,
    number = 0;
  for (const { id, block } of entries) {
    const numbered = block.kind === "checkpoint" || block.kind === "route_step";
    const defaultGap = previous === block.kind && numbered ? 0 : 1;
    const gap = block.kind === "section" ? (block.gap ?? defaultGap) : defaultGap;
    if (result) result += "\n".repeat(1 + gap);
    if (block.kind === "section") {
      result += `${"#".repeat(level)} ${block.title}\n\n${render(block.children, level + 1)}`;
    } else if (block.kind === "rule_include") {
      result += `<!-- rule:${block.document}#${block.fragment} -->`;
    } else {
      const text = block.text.replace(/\n+$/, "");
      if (numbered) {
        number = previous === block.kind ? number + 1 : 1;
        const [first, ...rest] = text.split("\n");
        const indent = " ".repeat(String(number).length + 2);
        result +=
          `${number}. **${id} — ${block.title}** ${first}` +
          rest.map((line) => "\n" + (line ? indent + line : "")).join("");
      } else result += text;
    }
    previous = block.kind;
  }
  return result;
}

function buildFragments(title: string, entries: Entry[]) {
  const fragments: Fragment[] = [];
  const renderers = new Map<string, () => string>();
  const sectionIds = new Map<string, string>();
  const counts = new Map([[headingSlug(title), 1]]);
  function visitEntries(items: Entry[], level: number) {
    for (const { id, block } of items) {
      if (block.kind === "section") {
        const base = headingSlug(block.title),
          count = counts.get(base) ?? 0;
        counts.set(base, count + 1);
        const anchor = count ? `${base}-${count}` : base;
        sectionIds.set(anchor, id);
        if (block.expose) {
          fragments.push({ id, title: block.title, kind: block.kind, anchor });
          renderers.set(id, () => render(block.children, level + 1));
        }
        visitEntries(block.children, level + 1);
      } else if (block.kind === "route_step") {
        const { kind, title, phase, hook } = block;
        fragments.push({ id, title, kind, phase, hook });
        renderers.set(id, () => block.text);
      } else if (block.kind === "checkpoint") {
        fragments.push({ id, title: block.title, kind: block.kind, applicability: block.applicability });
        renderers.set(id, () => block.text);
      } else if (block.kind === "markdown" && block.expose) {
        fragments.push({ id, title: string(block.title, id), kind: block.kind });
        renderers.set(id, () => block.text);
      }
    }
  }
  visitEntries(entries, 2);
  return { fragments, renderers, sectionIds };
}

export function loadReferenceData(root: string) {
  const rules = realpathSync(root);
  const digest = createHash("sha256");
  const documents = new Map<string, ReferenceDocument>();
  const documentsByPath = new Map<string, ReferenceDocument>();
  const sources = new Map<string, string>();
  const entries = new Map<string, { file: string; hash: string; renderers: Map<string, () => string> }>();
  const hookBodies = new Map<string, () => string>();
  const hookTriggers = new Map<string, unknown>();
  const verified = new Set<string>();
  const cache = new Map<string, string>();

  function read(file: string): Buffer {
    const path = join(rules, file);
    if (realpathSync(path) !== path) throw new Error(`规则源不允许符号链接：${path}`);
    return readFileSync(path);
  }
  function yamlFiles(directory: string): string[] {
    return readdirSync(join(rules, directory), { withFileTypes: true }).flatMap((item) => {
      const file = `${directory}/${item.name}`;
      if (item.isSymbolicLink()) throw new Error(`规则源不允许符号链接：${file}`);
      if (item.isDirectory()) return yamlFiles(file);
      return item.isFile() && item.name.endsWith(".yaml") && file !== "hooks/SOURCE_COVERAGE.yaml"
        ? [file]
        : [];
    });
  }

  for (const file of [
    ...["references", "coding-workflows", "hooks"].flatMap(yamlFiles),
    "SKILL.yaml",
    "workflows/coding.yaml",
  ].sort()) {
    const source = read(file);
    const yaml = parseDocument(source.toString("utf8"), { uniqueKeys: true, schema: "core" });
    const issue = yaml.errors[0] ?? yaml.warnings[0];
    if (issue) throw new Error(`无效的规则 YAML：${file}：${issue.message}`);
    visit(yaml, (_key, node) => {
      if (isAlias(node) || (isNode(node) && "anchor" in node && node.anchor))
        throw new Error(`规则 YAML 不允许锚点或别名：${file}`);
    });
    const raw = mapping(yaml.toJS({ maxAliasCount: 0 }), file);
    const owner = file.startsWith("hooks/");
    const id = string(raw.id, file, DOCUMENT_ID);
    const path = file.replace(/\.yaml$/, ".md");
    if (
      raw.schema_version !== 1 ||
      raw.markdown_path !== path ||
      (owner && id !== (file === "hooks/README.yaml" ? "readme" : file.slice(6, -5)))
    ) {
      throw new Error(`规则 YAML 的版本、路径或 Hook ID 不匹配：${file}`);
    }
    const title = string(raw.title, file, /^[^\r\n]+$/);
    const titleGap = gap(raw.blank_lines_after_title, file, 1) ?? 2;
    const blocks = readEntries(raw.blocks, file);
    const { fragments, renderers, sectionIds } = buildFragments(title, blocks);
    const documentId = owner ? `hook-${id}` : id;
    if (documents.has(documentId)) throw new Error(`重复的规则文档 ID：${documentId}`);
    const document = { id: documentId, path, title, fragments, sectionIds };
    documents.set(documentId, document);
    documentsByPath.set(path, document);
    sources.set(path, file);
    entries.set(documentId, { file, hash: sha256(source), renderers });
    digest.update(file).update("\0").update(source).update("\0");
    if (owner && raw.document_type === "hook-contract") {
      const execution = blocks.filter((block) => !["flowchart", "checkpoints", "sources"].includes(block.id));
      hookBodies.set(id, () => `# ${title}${"\n".repeat(titleGap)}${render(execution, 2)}`);
      hookTriggers.set(id, raw.activate_on);
    }
  }

  function document(id: string): ReferenceDocument {
    const result = documents.get(id);
    if (!result) throw new Error(`规则 DSL 缺少文档：${id}`);
    return result;
  }
  function readBody(owner: string, key: string, renderer: () => string): string {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const source = entries.get(owner)!;
    if (!verified.has(owner)) {
      if (sha256(read(source.file)) !== source.hash) throw new Error(`规则 YAML Hash 不匹配：${source.file}`);
      verified.add(owner);
    }
    const body = renderer().trimEnd();
    if (!body) throw new Error(`规则正文为空：${key}`);
    cache.set(key, body);
    return body;
  }
  function readFragment(documentId: string, id: string): string {
    const key = `${documentId}#${id}`;
    const renderer = entries.get(documentId)?.renderers.get(id);
    if (!renderer) throw new Error(`规则 DSL 缺少片段：${key}`);
    return readBody(documentId, key, renderer);
  }
  function readHook(id: string): string {
    const renderer = hookBodies.get(id);
    if (!renderer) throw new Error(`规则 DSL 缺少 Hook：${id}`);
    return readBody(`hook-${id}`, `hooks/${id}`, renderer);
  }
  return {
    digest: digest.digest("hex"),
    document,
    readFragment,
    readHook,
    hookActivation: (id: string) => hookTriggers.get(id),
    documentPaths: () => documentsByPath.keys(),
    documentForPath: (path: string) => documentsByPath.get(path),
    sourceForPath: (path: string) => sources.get(path),
  };
}
