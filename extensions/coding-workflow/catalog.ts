import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SKILL_ROOT = fileURLToPath(new URL("../../docs/skill/", import.meta.url));
export const PHASES = ["entry", "session", "definition", "execution", "verification", "documentation", "delivery"] as const;
export type Phase = typeof PHASES[number];
export type Mode = "single" | "multi";
export const HOOK_IDS = ["foundation", "entry", "session", "planning", "execution", "delegation", "context", "audit", "verification", "repair", "documentation", "delivery", "recovery", "navigation", "advisory", "materialization"] as const;
export type HookId = typeof HOOK_IDS[number];
export const SIGNALS = ["requirements_changed", "decision_required", "repair_required", "documentation_impact", "git_changed", "context_exchange", "advice_requested", "materialization_requested", "capability_changed"] as const;
export type SemanticSignal = typeof SIGNALS[number];
export interface Checkpoint { id: string; title: string; instruction: string; conditional: boolean }
export interface Module { name: string; path: string; checkpoints: Checkpoint[] }
export interface Catalog {
  root: string;
  modules: Record<string, Module>;
  hooks: Record<HookId, string>;
  digest: string;
  coverage: { path: string; hooks: HookId[]; kind: "rule" | "navigation" | "reference" }[];
}
const MODULES = ["entry-readiness", "session-readiness", "work-definition", "single-execution", "delegated-execution", "verification-repair", "documentation", "delivery-acceptance"];
const CONDITIONAL = new Set(["SR04", "DE03", "DE05", "DE06", "SE04", "DA02", "DOC03"]);
const EXPECTED_IDS: Record<string, string[]> = {
  "entry-readiness": ["ER00", "ER01", "ER02", "ER03"],
  "session-readiness": ["SR00", "SR01", "SR02", "SR03", "SR04"],
  "work-definition": ["WD00", "WD01", "WD02", "WD03"],
  "single-execution": ["SE00", "SE01", "SE02", "SE03", "SE04", "SE05", "SE06"],
  "delegated-execution": Array.from({ length: 10 }, (_, i) => `DE0${i}`),
  "verification-repair": Array.from({ length: 7 }, (_, i) => `VR0${i}`),
  documentation: Array.from({ length: 7 }, (_, i) => `DOC0${i}`),
  "delivery-acceptance": Array.from({ length: 6 }, (_, i) => `DA0${i}`),
};
export function moduleName(phase: Phase, mode: Mode): string {
  return ({ entry: "entry-readiness", session: "session-readiness", definition: "work-definition", execution: mode === "single" ? "single-execution" : "delegated-execution", verification: "verification-repair", documentation: "documentation", delivery: "delivery-acceptance" })[phase];
}

/** Exact checkpoint IDs are deliberate: a changed route must be reviewed, not silently inferred. */
export function parseModule(path: string, text: string): Module {
  const name = path.split("/").pop()!.replace(/\.md$/, "");
  const section = text.split("## 有序模块清单\n")[1]?.split(/^## /m)[0];
  if (!section) throw new Error(`缺少有序模块清单：${path}`);
  const starts = [...section.matchAll(/^\d+\. \*\*([A-Z]+\d+) — ([^*]+)\*\*/gm)];
  const checkpoints = starts.map((match, i) => ({
    id: match[1], title: match[2].trim(),
    instruction: section.slice(match.index! + match[0].length, starts[i + 1]?.index ?? section.length).trim(),
    conditional: CONDITIONAL.has(match[1]),
  }));
  if (JSON.stringify(checkpoints.map(c => c.id)) !== JSON.stringify(EXPECTED_IDS[name])) throw new Error(`检查点契约变化，须审阅 Extension：${path}`);
  if (checkpoints.some(c => !c.instruction)) throw new Error(`检查点为空：${path}`);
  return { name, path, checkpoints };
}

const L1_HOOKS: Record<string, HookId[]> = {
  "context-exchange": ["context"], delegation: ["delegation", "session"],
  "execution-control": ["execution"], "execution-planning": ["planning"],
  "session-runtime": ["session", "audit"], "workflow-navigation": ["navigation"],
};
const L2_HOOKS: Record<string, HookId[]> = {
  "entry-and-context": ["entry", "planning"], "decision-and-execution": ["execution", "planning"],
  "verification-and-repair": ["verification", "repair"], "completion-and-effects": ["documentation", "delivery"],
};
const OVERRIDES: Record<string, HookId[]> = {
  "candidate-compliance": ["materialization"], "output-materialization": ["materialization"],
  "decisions-advisory": ["advisory"], "decision-context-generation": ["advisory", "planning"],
  "workflow-routing-advice": ["navigation", "advisory"], "workflow-module-contract": ["recovery"],
  "LSP-MCP-Tools": ["context", "session"], "runtime-provider-support": ["foundation", "session"],
  "session-context-firewall": ["context"], "reasoning-summary-visibility": ["audit"], "session-audit-visibility": ["audit"],
};
export function classifySource(path: string): Catalog["coverage"][number] {
  const parts = path.split("/");
  const stem = parts.at(-1)!.replace(/\.md$/, "");
  const kind = ["INDEX", "README"].includes(stem) ? "navigation" : "rule";
  if (parts.includes("multimodal")) return { path, hooks: ["foundation"], kind: "reference" };
  if (OVERRIDES[stem]) return { path, hooks: OVERRIDES[stem], kind };
  if (parts.includes("share") || path === "SKILL.md") return { path, hooks: ["foundation"], kind };
  const layer = parts.findIndex(p => p.startsWith("layer-"));
  if (layer >= 0) {
    const number = parts[layer].slice(6, 8);
    const group = parts[layer + 1];
    if (number === "01" || number === "02") {
      if (!group || /\.md$/.test(group)) return { path, hooks: ["navigation"], kind };
      const hooks = (number === "01" ? L1_HOOKS : L2_HOOKS)[group];
      if (hooks) return { path, hooks, kind };
    }
    if (number === "03") return { path, hooks: ["navigation", "execution"], kind };
    if (number === "04") {
      const phase = PHASES.find(p => moduleName(p, "single") === stem || moduleName(p, "multi") === stem);
      return { path, hooks: phase ? phaseHooks(phase, "multi") : ["navigation"], kind };
    }
  }
  if (path === "PI_EXTENSION.md") return { path, hooks: ["foundation", "navigation"], kind: "navigation" };
  if (path === "workflows/coding.md" || path === "WORKFLOW_ARCHITECTURE.md") return { path, hooks: ["foundation", "navigation"], kind };
  throw new Error(`没有 Hook 归属的规则：${path}`);
}
export function phaseHooks(phase: Phase, mode: Mode): HookId[] {
  const table: Record<Phase, HookId[]> = {
    entry: ["entry", "navigation"], session: ["session", "audit"], definition: ["planning", "context"],
    execution: mode === "multi" ? ["execution", "delegation"] : ["execution"],
    verification: ["verification", "repair"], documentation: ["documentation", "context"], delivery: ["delivery"],
  };
  return [...new Set<HookId>(["foundation", ...table[phase], ...(["execution", "verification", "documentation", "delivery"].includes(phase) ? ["planning" as const] : []), ...(phase === "execution" && mode === "multi" ? ["context" as const, "audit" as const] : [])])];
}
export function signalHooks(signal: SemanticSignal): HookId[] {
  return ({ requirements_changed: ["entry", "planning"], decision_required: ["planning"], repair_required: ["repair", "verification"], documentation_impact: ["documentation", "verification"], git_changed: ["delivery", "verification"], context_exchange: ["context"], advice_requested: ["advisory"], materialization_requested: ["materialization"], capability_changed: ["session", "entry"] } satisfies Record<SemanticSignal, HookId[]>)[signal];
}
function markdownFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink()) throw new Error(`规则源不允许符号链接：${entry.name}`);
    const path = join(root, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith(".md") ? [path] : [];
  }).sort();
}
export function loadCatalog(root = SKILL_ROOT): Catalog {
  const modules: Record<string, Module> = {};
  const hash = createHash("sha256");
  for (const file of ["catalog.ts", "engine.ts", "runtime.ts", "index.ts"]) hash.update(file).update(readFileSync(new URL(file, import.meta.url)));
  for (const name of MODULES) {
    const path = `references/coding/layer-04-workflows/modules/${name}.md`;
    const text = readFileSync(join(root, path), "utf8");
    modules[name] = parseModule(path, text); hash.update(path).update(text);
  }
  const hooks = {} as Record<HookId, string>;
  for (const id of HOOK_IDS) {
    const text = readFileSync(join(root, "hooks", `${id}.md`), "utf8");
    for (const title of ["触发条件", "执行要求", "退出与阻断", "重新核验", "规则来源"]) {
      if (!text.includes(`## ${title}\n`)) throw new Error(`Hook ${id} 缺少 ${title}`);
    }
    hooks[id] = text; hash.update(id).update(text);
  }
  const sources = markdownFiles(root).filter(p => !relative(root, p).startsWith("hooks/"));
  const coverage = sources.map(path => {
    const rel = relative(root, path).split("\\").join("/");
    hash.update(rel).update(readFileSync(path));
    return classifySource(rel);
  });
  // File hashes detect drift, not semantic equivalence or policy correctness.
  return { root: resolve(root), modules, hooks, coverage, digest: hash.digest("hex") };
}
export function currentModule(catalog: Catalog, phase: Phase, mode: Mode): Module { return catalog.modules[moduleName(phase, mode)]; }
/** Resolve against the resource document, never the user's unrelated working directory. */
export function resolveDocumentLink(root: string, document: string, target: string): { path: string; fragment: string; url: string } | undefined {
  const href = target.replace(/^<|>$/g, "");
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return undefined;
  const [beforeHash, ...hash] = href.split("#");
  const [file, ...query] = beforeHash.split("?");
  const source = resolve(root, document);
  const path = file ? resolve(dirname(source), decodeURIComponent(file)) : source;
  const rel = relative(resolve(root), path);
  if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel) || path.includes("\0")) throw new Error(`文档链接越出 Skill：${document} -> ${target}`);
  const fragment = decodeURIComponent(hash.join("#"));
  const url = pathToFileURL(path);
  if (query.length) url.search = query.join("?");
  if (hash.length) url.hash = hash.join("#");
  return { path, fragment, url: url.href };
}

/** Repository Markdown uses inline links and reference definitions; fenced examples are not links. */
export function mapDocumentLinks(markdown: string, transform: (target: string) => string): string {
  let fence: { character: string; length: number } | undefined;
  return markdown.split("\n").map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) { if (marker?.[1][0] === fence.character && marker[1].length >= fence.length && !line.slice(marker[0].length).trim()) fence = undefined; return line; }
    if (marker) { fence = { character: marker[1][0], length: marker[1].length }; return line; }
    // Keep titles, labels and angle-bracket destination syntax intact.
    const replace = (_match: string, prefix: string, target: string) => prefix + (target.startsWith("<") ? `<${transform(target.slice(1, -1))}>` : transform(target));
    return line.replace(/(`+)[^\n]*?\1|(!?\[[^\]\n]*\]\()(<[^>\n]+>|[^\s)]+)(?=[ \t]*(?:\)|["']))/g,
      (match, code: string | undefined, prefix: string | undefined, target: string) => code || !prefix ? match : replace(match, prefix, target))
      .replace(/^( {0,3}\[[^\]\n]+\]:[ \t]*)(<[^>\n]+>|[^\s]+)(?=[ \t]|$)/, replace);
  }).join("\n");
}

export function documentLinks(markdown: string): string[] {
  const links: string[] = [];
  mapDocumentLinks(markdown, target => { links.push(target); return target; });
  return links;
}

export function rewriteDocumentLinks(root: string, document: string, markdown: string): string {
  return mapDocumentLinks(markdown, target => resolveDocumentLink(root, document, target)?.url ?? target);
}

export function resolveHookLink(root: string, hook: HookId, target: string): string {
  const link = resolveDocumentLink(root, `hooks/${hook}.md`, target);
  if (!link) throw new Error(`不是本地来源链接：${target}`);
  return link.path;
}
