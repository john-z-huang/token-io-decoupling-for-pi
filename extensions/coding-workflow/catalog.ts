import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadReferenceData } from "./reference-data.ts";

export const SKILL_ROOT = fileURLToPath(new URL("../../docs/skill/", import.meta.url));
const WORKFLOW_DIR = "references/coding/layer-04-workflows";
export const PHASES = ["entry", "session", "definition", "execution", "verification", "documentation", "delivery"] as const;
export type Phase = typeof PHASES[number];
export type Mode = "single" | "multi";
export const HOOK_IDS = ["foundation", "entry", "session", "planning", "execution", "delegation", "context", "audit", "verification", "repair", "documentation", "delivery", "recovery", "navigation", "advisory", "materialization"] as const;
export type HookId = typeof HOOK_IDS[number];
export const SIGNALS = ["requirements_changed", "decision_required", "executor_changed", "repair_required", "documentation_impact", "git_changed", "context_exchange", "advice_requested", "materialization_requested", "capability_changed"] as const;
export type SemanticSignal = typeof SIGNALS[number];
export interface Checkpoint { id: string; title: string; instruction: string; conditional: boolean }
export interface Module { name: string; path: string; checkpoints: Checkpoint[] }
interface RouteStep { id: string; title: string; module: string }
interface Route { documentId: string; steps: Record<Phase, RouteStep> }
export interface Catalog {
  root: string;
  modules: Record<string, Module>;
  routes: Record<Mode, Route>;
  references: ReturnType<typeof loadReferenceData>;
  digest: string;
}
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
// 固定引擎目前支持的拓扑，发布时用 DSL 索引校验实际路线。
function expectedModule(phase: Phase, mode: Mode): string {
  return ({ entry: "entry-readiness", session: "session-readiness", definition: "work-definition", execution: mode === "single" ? "single-execution" : "delegated-execution", verification: "verification-repair", documentation: "documentation", delivery: "delivery-acceptance" })[phase];
}

function loadRoute(references: Catalog["references"], mode: Mode): Route {
  const documentId = `coding-${mode}-agent`;
  const document = references.document(documentId);
  const prefix = mode === "single" ? "SM" : "MM";
  const steps = document.fragments.filter(item => item.kind === "route_step");
  if (document.path !== `${WORKFLOW_DIR}/${documentId}.md` || steps.length !== PHASES.length ||
      !PHASES.every((phase, i) => steps[i].phase === phase && steps[i].id === `${prefix}0${i + 1}` && steps[i].module === expectedModule(phase, mode))) {
    throw new Error(`路线契约变化，须审阅 Extension：${document.path}`);
  }
  const bindings = {} as Record<Phase, RouteStep>;
  PHASES.forEach((phase, i) => { bindings[phase] = steps[i]; });
  return { documentId, steps: bindings };
}

export function phaseHooks(phase: Phase, mode: Mode): HookId[] {
  const table: Record<Phase, HookId[]> = {
    entry: ["entry", "navigation"], session: ["session", "audit"], definition: ["planning", "context"],
    execution: mode === "multi" ? ["execution", "delegation"] : ["execution"],
    verification: ["verification"], documentation: ["documentation", "context"], delivery: ["delivery"],
  };
  return [...new Set<HookId>(["foundation", ...table[phase], ...(["execution", "verification", "documentation", "delivery"].includes(phase) ? ["planning" as const] : []), ...(phase === "execution" && mode === "multi" ? ["context" as const, "audit" as const] : [])])];
}
export function signalHooks(signal: SemanticSignal): HookId[] {
  return ({ requirements_changed: ["entry", "planning"], decision_required: ["planning"], executor_changed: ["execution", "delegation"], repair_required: ["repair", "verification"], documentation_impact: ["documentation", "verification"], git_changed: ["delivery", "verification"], context_exchange: ["context"], advice_requested: ["advisory"], materialization_requested: ["materialization"], capability_changed: ["session", "entry"] } satisfies Record<SemanticSignal, HookId[]>)[signal];
}
export function loadCatalog(root = SKILL_ROOT): Catalog {
  const modules: Record<string, Module> = {};
  const hash = createHash("sha256");
  for (const file of ["catalog.ts", "engine.ts", "runtime.ts", "index.ts", "model-selection.ts", "startup.ts", "reference-data.ts"]) hash.update(file).update(readFileSync(new URL(file, import.meta.url)));
  const references = loadReferenceData(root);
  hash.update("reference-data/manifest.json").update(references.manifest);
  const routes = { single: loadRoute(references, "single"), multi: loadRoute(references, "multi") };
  for (const [name, expected] of Object.entries(EXPECTED_IDS)) {
    const document = references.document(name);
    const path = `${WORKFLOW_DIR}/modules/${name}.md`;
    const checkpoints = document.fragments.filter(item => item.kind === "checkpoint").map(({ id, title }) => ({
      id, title, conditional: CONDITIONAL.has(id),
      get instruction() { return references.readFragment(name, id); },
    }));
    if (document.path !== path || checkpoints.length !== expected.length || checkpoints.some((item, i) => item.id !== expected[i])) {
      throw new Error(`检查点契约变化，须审阅 Extension：${path}`);
    }
    modules[name] = { name, path, checkpoints };
  }
  for (const id of HOOK_IDS) {
    if (!references.hasHook(id)) throw new Error(`规则片段索引缺少 Hook：${id}`);
  }
  // 快照使用代码与规则索引的指纹，不扫描文档导出目录。
  return { root: resolve(root), modules, routes, references, digest: hash.digest("hex") };
}
export function currentModule(catalog: Catalog, phase: Phase, mode: Mode): Module { return catalog.modules[catalog.routes[mode].steps[phase].module]; }
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

export function headingSlug(title: string): string {
  return title.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/<[^>]*>/g, "").toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "").replace(/ /g, "-");
}

export function ruleLink(document: string, fragment?: string): string {
  return `coding-rule:${document}${fragment ? `#${fragment}` : ""}`;
}

export function rewriteWorkflowLinks(catalog: Catalog, source: string, markdown: string): string {
  return mapDocumentLinks(markdown, target => {
    const link = resolveDocumentLink(catalog.root, source, target);
    if (!link) return target;
    const document = catalog.references.documentForPath(relative(catalog.root, link.path).split(sep).join("/"));
    if (!document) return link.url;
    const section = document.fragments.find(item => item.kind === "section" && headingSlug(item.title) === link.fragment);
    return ruleLink(document.id, section?.id);
  });
}

export function resolveHookLink(root: string, hook: HookId, target: string): string {
  const link = resolveDocumentLink(root, `hooks/${hook}.md`, target);
  if (!link) throw new Error(`不是本地来源链接：${target}`);
  return link.path;
}
