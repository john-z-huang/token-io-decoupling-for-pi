import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

interface Fragment {
  id: string;
  kind: "checkpoint" | "section";
  title: string;
  sha256: string;
}

interface ReferenceDocument {
  id: string;
  path: string;
  sha256: string;
  fragments: Fragment[];
}

const DOCUMENT_ID = /^[a-z][a-z0-9-]*$/;
const FRAGMENT_ID = /^[A-Za-z][A-Za-z0-9-]*$/;
const MARKDOWN_PATH = /^references\/(?:[A-Za-z0-9_-]+\/)+[A-Za-z0-9_-]+\.md$/;
const SHA256 = /^[0-9a-f]{64}$/;

export function loadReferenceData(root: string) {
  const data = join(realpathSync(root), "reference-data");
  function read(...parts: string[]): Buffer {
    const path = join(data, ...parts);
    if (realpathSync(path) !== path) throw new Error(`规则资源不允许符号链接：${path}`);
    return readFileSync(path);
  }

  const manifest = read("manifest.json").toString("utf8");
  const parsed = JSON.parse(manifest) as { schema_version?: unknown; documents?: ReferenceDocument[] } | null;
  if (parsed?.schema_version !== 1 || !Array.isArray(parsed.documents)) throw new Error("规则片段索引版本或结构不匹配");
  const documents = new Map<string, ReferenceDocument>();
  const markdownHashes = new Map<string, string>();
  for (const document of parsed.documents) {
    if (!document || typeof document.id !== "string" || !DOCUMENT_ID.test(document.id) || documents.has(document.id) ||
        typeof document.path !== "string" || !MARKDOWN_PATH.test(document.path) || markdownHashes.has(document.path) ||
        typeof document.sha256 !== "string" || !SHA256.test(document.sha256) || !Array.isArray(document.fragments)) {
      throw new Error("规则片段索引含无效或重复的文档");
    }
    const seen = new Set<string>();
    for (const fragment of document.fragments) {
      if (!fragment || typeof fragment.id !== "string" || !FRAGMENT_ID.test(fragment.id) || seen.has(fragment.id) ||
          !["checkpoint", "section"].includes(fragment.kind) || typeof fragment.title !== "string" || !fragment.title.trim() ||
          typeof fragment.sha256 !== "string" || !SHA256.test(fragment.sha256)) {
        throw new Error(`规则片段索引含无效或重复的片段：${document.id}`);
      }
      seen.add(fragment.id);
    }
    documents.set(document.id, document);
    markdownHashes.set(document.path, document.sha256);
  }

  function document(id: string): ReferenceDocument {
    const result = documents.get(id);
    if (!result) throw new Error(`规则片段索引缺少文档：${id}`);
    return result;
  }

  const cache = new Map<string, string>();
  function readFragment(documentId: string, id: string): string {
    const key = `${documentId}#${id}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const metadata = document(documentId).fragments.find(fragment => fragment.id === id);
    if (!metadata) throw new Error(`规则片段索引缺少片段：${key}`);
    let content: Buffer;
    try {
      content = read("fragments", documentId, `${id}.txt`);
    } catch (error) {
      throw new Error(`无法读取规则片段：${key}`, { cause: error });
    }
    const body = content.toString("utf8").trimEnd();
    if (!body || createHash("sha256").update(content).digest("hex") !== metadata.sha256) {
      throw new Error(`规则片段为空或 Hash 不匹配：${key}`);
    }
    cache.set(key, body);
    return body;
  }

  return { manifest, markdownHashes, document, readFragment };
}
