import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

interface FragmentMetadata {
  id: string;
  title: string;
  sha256: string;
}

type Fragment = FragmentMetadata & (
  | { kind: "checkpoint" | "markdown" }
  | { kind: "section"; anchor: string }
  | { kind: "route_step"; phase: string; module: string }
);

interface ReferenceDocument {
  id: string;
  path: string;
  title: string;
  source_sha256: string;
  fragments: Fragment[];
}

const DOCUMENT_ID = /^[a-z][a-z0-9-]*$/;
const FRAGMENT_ID = /^[A-Za-z][A-Za-z0-9-]*$/;
const MARKDOWN_PATH = /^references\/(?:[A-Za-z0-9_-]+\/)+[A-Za-z0-9_-]+\.md$/;
const SHA256 = /^[0-9a-f]{64}$/;

export function loadReferenceData(root: string) {
  const skill = realpathSync(root);
  function read(...parts: string[]): Buffer {
    const path = join(skill, ...parts);
    if (realpathSync(path) !== path) throw new Error(`规则资源不允许符号链接：${path}`);
    return readFileSync(path);
  }

  const manifest = read("reference-data", "manifest.json").toString("utf8");
  const parsed = JSON.parse(manifest) as { schema_version?: unknown; documents?: ReferenceDocument[]; hooks?: Record<string, string>; legacy_rule_sha256?: unknown } | null;
  if (parsed?.schema_version !== 4 || !Array.isArray(parsed.documents) || !parsed.hooks || typeof parsed.hooks !== "object" || Array.isArray(parsed.hooks) ||
      typeof parsed.legacy_rule_sha256 !== "string" || !SHA256.test(parsed.legacy_rule_sha256)) {
    throw new Error("规则片段索引版本或结构不匹配");
  }
  const hookHashes = new Map(Object.entries(parsed.hooks));
  for (const [id, digest] of hookHashes) {
    if (!DOCUMENT_ID.test(id) || typeof digest !== "string" || !SHA256.test(digest)) throw new Error(`规则片段索引含无效 Hook：${id}`);
  }
  const documents = new Map<string, ReferenceDocument>();
  const documentsByPath = new Map<string, ReferenceDocument>();
  for (const document of parsed.documents) {
    if (!document || typeof document.id !== "string" || !DOCUMENT_ID.test(document.id) || documents.has(document.id) ||
        typeof document.path !== "string" || !MARKDOWN_PATH.test(document.path) || documentsByPath.has(document.path) ||
        typeof document.title !== "string" || !document.title.trim() || typeof document.source_sha256 !== "string" || !SHA256.test(document.source_sha256) ||
        !Array.isArray(document.fragments)) {
      throw new Error("规则片段索引含无效或重复的文档");
    }
    const seen = new Set<string>();
    for (const fragment of document.fragments) {
      if (!fragment || typeof fragment.id !== "string" || !FRAGMENT_ID.test(fragment.id) || seen.has(fragment.id) ||
          !["checkpoint", "section", "route_step", "markdown"].includes(fragment.kind) || typeof fragment.title !== "string" || !fragment.title.trim() ||
          typeof fragment.sha256 !== "string" || !SHA256.test(fragment.sha256)) {
        throw new Error(`规则片段索引含无效或重复的片段：${document.id}`);
      }
      if (fragment.kind === "section" && (typeof fragment.anchor !== "string" || !fragment.anchor)) {
        throw new Error(`规则片段索引缺少章节锚点：${document.id}#${fragment.id}`);
      }
      if (fragment.kind === "route_step" && (typeof fragment.phase !== "string" || typeof fragment.module !== "string" || !DOCUMENT_ID.test(fragment.module))) {
        throw new Error(`规则片段索引含无效路线项：${document.id}#${fragment.id}`);
      }
      seen.add(fragment.id);
    }
    documents.set(document.id, document);
    documentsByPath.set(document.path, document);
  }

  function document(id: string): ReferenceDocument {
    const result = documents.get(id);
    if (!result) throw new Error(`规则片段索引缺少文档：${id}`);
    return result;
  }

  const cache = new Map<string, string>();
  function readHashedText(key: string, hash: string, ...path: string[]): string {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    let content: Buffer;
    try {
      content = read(...path);
    } catch (error) {
      throw new Error(`无法读取规则片段：${key}`, { cause: error });
    }
    const body = content.toString("utf8");
    if (!body.trim() || createHash("sha256").update(content).digest("hex") !== hash) {
      throw new Error(`规则片段为空或 Hash 不匹配：${key}`);
    }
    cache.set(key, body);
    return body;
  }

  function readFragment(documentId: string, id: string): string {
    const key = `${documentId}#${id}`;
    const metadata = document(documentId).fragments.find(fragment => fragment.id === id);
    if (!metadata) throw new Error(`规则片段索引缺少片段：${key}`);
    return readHashedText(key, metadata.sha256, "reference-data", "fragments", documentId, `${id}.txt`).trimEnd();
  }

  function readHook(id: string): string {
    const hash = hookHashes.get(id);
    if (!hash) throw new Error(`规则片段索引缺少 Hook：${id}`);
    return readHashedText(`hooks/${id}.txt`, hash, "reference-data", "hooks", `${id}.txt`).trimEnd();
  }

  return {
    manifest, document, readFragment, readHook,
    hasHook: (id: string) => hookHashes.has(id),
    documentPaths: () => documentsByPath.keys(),
    documentForPath: (path: string) => documentsByPath.get(path),
  };
}
