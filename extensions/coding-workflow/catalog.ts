import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadReferenceData } from "./reference-data.ts";

export const RULES_ROOT = fileURLToPath(new URL("../../docs/rules/", import.meta.url));
export { headingSlug } from "./reference-data.ts";
export const WORKFLOW_DIR = "coding-workflows";
const WORKFLOW_SOURCES = [
  "catalog.ts",
  "checkpoint-evidence.ts",
  "delegation.ts",
  "engine.ts",
  "index.ts",
  "model-selection.ts",
  "reference-data.ts",
  "runtime.ts",
  "startup.ts",
  "subagent-adapter.ts",
  "tool-guards.ts",
  "tool-schemas.ts",
  "workflow-context.ts",
  "workflow-state.ts",
  "workflow-tools.ts",
];
export const PHASES = [
  "entry",
  "session",
  "definition",
  "execution",
  "verification",
  "documentation",
  "delivery",
] as const;
export type Phase = (typeof PHASES)[number];
export type Mode = "single" | "multi";
export const HOOK_IDS = [
  "foundation",
  "entry",
  "session",
  "planning",
  "execution",
  "delegation",
  "context",
  "audit",
  "verification",
  "repair",
  "documentation",
  "delivery",
  "recovery",
  "navigation",
  "advisory",
  "materialization",
] as const;
export type HookId = (typeof HOOK_IDS)[number];
export const SIGNALS = [
  "requirements_changed",
  "decision_required",
  "executor_changed",
  "repair_required",
  "documentation_impact",
  "git_changed",
  "context_exchange",
  "advice_requested",
  "materialization_requested",
  "capability_changed",
] as const;
export type SemanticSignal = (typeof SIGNALS)[number];
const HOOK_TRIGGERS = [
  "workflow",
  ...PHASES,
  ...SIGNALS,
  "multi_execution",
  "recovery_needed",
  "repair_review",
  "independent_verification",
  "active_allocation",
] as const;
export type HookTrigger = (typeof HOOK_TRIGGERS)[number];
export interface Checkpoint {
  id: string;
  title: string;
  instruction: string;
  applicability?: "optional" | "sub_agent";
}
export interface Module {
  name: string;
  hook: HookId;
  path: string;
  checkpoints: Checkpoint[];
}
interface RouteStep {
  id: string;
  title: string;
  module: string;
  hook: HookId;
}
interface Route {
  documentId: string;
  phases: Phase[];
  steps: Record<Phase, RouteStep>;
}
export interface Catalog {
  root: string;
  modules: Record<string, Module>;
  routes: Record<Mode, Route>;
  hookTriggers: Record<HookId, HookTrigger[]>;
  references: ReturnType<typeof loadReferenceData>;
  digest: string;
}
// 宿主守卫和续接只依赖这些锚点。其余检查点及执行要求均由 Hook 提供。
const STAGE_HOOKS: Partial<Record<HookId, { phase: Phase; name: string; anchors: readonly string[] }>> = {
  entry: { phase: "entry", name: "entry-readiness", anchors: ["ER01"] },
  session: { phase: "session", name: "session-readiness", anchors: [] },
  planning: { phase: "definition", name: "work-definition", anchors: ["WD00", "WD01", "WD02", "WD03"] },
  execution: { phase: "execution", name: "single-execution", anchors: ["SE02"] },
  delegation: {
    phase: "execution",
    name: "delegated-execution",
    anchors: ["DE02", "DE03", "DE04", "DE05", "DE06"],
  },
  verification: {
    phase: "verification",
    name: "verification-repair",
    anchors: ["VR01", "VR02", "VR03", "VR05"],
  },
  documentation: { phase: "documentation", name: "documentation", anchors: ["DOC02", "DOC04", "DOC05"] },
  delivery: { phase: "delivery", name: "delivery-acceptance", anchors: ["DA01", "DA02", "DA03", "DA04"] },
};

function loadRoute(references: Catalog["references"], mode: Mode, modules: Catalog["modules"]): Route {
  const documentId = `coding-${mode}-agent`;
  const document = references.document(documentId);
  const steps = document.fragments.filter((item) => item.kind === "route_step");
  if (
    document.path !== `${WORKFLOW_DIR}/${documentId}.md` ||
    steps.length !== PHASES.length ||
    !PHASES.every((phase, i) => steps[i].phase === phase)
  ) {
    throw new Error(`路线契约变化，须审阅 Extension：${document.path}`);
  }
  const bindings = {} as Record<Phase, RouteStep>;
  const phases = steps.map(({ id, title, phase, hook }) => {
    const hookId = HOOK_IDS.find((candidate) => candidate === hook);
    const binding = hookId && STAGE_HOOKS[hookId];
    if (
      binding?.phase !== phase ||
      !modules[binding.name] ||
      (phase === "execution" && hook !== (mode === "single" ? "execution" : "delegation"))
    ) {
      throw new Error(`路线契约变化，阶段 ${phase} 无对应 Hook：${document.path}`);
    }
    bindings[binding.phase] = { id, title, module: binding.name, hook: modules[binding.name].hook };
    return binding.phase;
  });
  return { documentId, phases, steps: bindings };
}

export function loadCatalog(root = RULES_ROOT): Catalog {
  const modules: Record<string, Module> = Object.create(null);
  const hookTriggers = {} as Catalog["hookTriggers"];
  const hash = createHash("sha256");
  for (const file of WORKFLOW_SOURCES) {
    hash.update(file).update(readFileSync(new URL(file, import.meta.url)));
  }
  const references = loadReferenceData(root);
  hash.update("rules-yaml").update(references.digest);
  for (const hook of HOOK_IDS) {
    const activation = references.hookActivation(hook);
    if (
      !Array.isArray(activation) ||
      !activation.length ||
      new Set(activation).size !== activation.length ||
      activation.some((item) => !HOOK_TRIGGERS.includes(item))
    ) {
      throw new Error(`Hook ${hook} 的 activate_on 缺失或包含无效触发条件`);
    }
    hookTriggers[hook] = activation;
    const binding = STAGE_HOOKS[hook];
    if (!binding) continue;
    const document = references.document(hookDocument(hook));
    const checkpoints = document.fragments
      .filter((item) => item.kind === "checkpoint")
      .map(({ id, title, applicability }) => ({
        id,
        title,
        applicability,
        get instruction() {
          return references.readFragment(hookDocument(hook), id);
        },
      }));
    const anchors = checkpoints.filter(({ id }) => binding.anchors.includes(id)).map(({ id }) => id);
    if (
      !checkpoints.length ||
      anchors.join() !== binding.anchors.join() ||
      checkpoints.some(
        ({ id, applicability }) =>
          applicability === "sub_agent" && (hook !== "delegation" || id === "DE02" || id === "DE04"),
      )
    ) {
      throw new Error(`检查点契约变化，须核对宿主守卫锚点：${document.path}`);
    }
    modules[binding.name] = { name: binding.name, hook, path: document.path, checkpoints };
  }
  const routes = {
    single: loadRoute(references, "single", modules),
    multi: loadRoute(references, "multi", modules),
  };
  // 快照使用代码与规则索引的指纹，不扫描文档导出目录。
  return { root: resolve(root), modules, routes, hookTriggers, references, digest: hash.digest("hex") };
}
export function currentModule(catalog: Catalog, phase: Phase, mode: Mode): Module {
  return catalog.modules[catalog.routes[mode].steps[phase].module];
}
/** Resolve against the resource document, never the user's unrelated working directory. */
export function resolveDocumentLink(
  root: string,
  document: string,
  target: string,
): { path: string; fragment: string; url: string } | undefined {
  const href = target.replace(/^<|>$/g, "");
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return undefined;
  const [beforeHash, ...hash] = href.split("#");
  const [file, ...query] = beforeHash.split("?");
  const source = resolve(root, document);
  const path = file ? resolve(dirname(source), decodeURIComponent(file)) : source;
  const rel = relative(resolve(root), path);
  if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel) || path.includes("\0"))
    throw new Error(`文档链接越出 Skill：${document} -> ${target}`);
  const fragment = decodeURIComponent(hash.join("#"));
  const url = pathToFileURL(path);
  if (query.length) url.search = query.join("?");
  if (hash.length) url.hash = hash.join("#");
  return { path, fragment, url: url.href };
}

/** Repository Markdown uses inline links and reference definitions; fenced examples are not links. */
export function mapDocumentLinks(markdown: string, transform: (target: string) => string): string {
  let fence: { character: string; length: number } | undefined;
  return markdown
    .split("\n")
    .map((line) => {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fence) {
        if (
          marker?.[1][0] === fence.character &&
          marker[1].length >= fence.length &&
          !line.slice(marker[0].length).trim()
        )
          fence = undefined;
        return line;
      }
      if (marker) {
        fence = { character: marker[1][0], length: marker[1].length };
        return line;
      }
      // Keep titles, labels and angle-bracket destination syntax intact.
      const replace = (_match: string, prefix: string, target: string) =>
        prefix + (target.startsWith("<") ? `<${transform(target.slice(1, -1))}>` : transform(target));
      return line
        .replace(
          /(`+)[^\n]*?\1|(!?\[[^\]\n]*\]\()(<[^>\n]+>|[^\s)]+)(?=[ \t]*(?:\)|["']))/g,
          (match, code: string | undefined, prefix: string | undefined, target: string) =>
            code || !prefix ? match : replace(match, prefix, target),
        )
        .replace(/^( {0,3}\[[^\]\n]+\]:[ \t]*)(<[^>\n]+>|[^\s]+)(?=[ \t]|$)/, replace);
    })
    .join("\n");
}

export function documentLinks(markdown: string): string[] {
  const links: string[] = [];
  mapDocumentLinks(markdown, (target) => {
    links.push(target);
    return target;
  });
  return links;
}

export function rewriteDocumentLinks(root: string, document: string, markdown: string): string {
  return mapDocumentLinks(markdown, (target) => resolveDocumentLink(root, document, target)?.url ?? target);
}

export function ruleLink(document: string, fragment?: string): string {
  return `coding-rule:${document}${fragment ? `#${fragment}` : ""}`;
}

export function hookDocument(id: HookId): string {
  return `hook-${id}`;
}

export function rewriteWorkflowLinks(catalog: Catalog, source: string, markdown: string): string {
  return mapDocumentLinks(markdown, (target) => {
    const link = resolveDocumentLink(catalog.root, source, target);
    if (!link) return target;
    const path = relative(catalog.root, link.path).split(sep).join("/");
    const yaml = path.endsWith(".yaml");
    const exportPath = yaml ? path.replace(/\.yaml$/, ".md") : path;
    const document = catalog.references.documentForPath(exportPath);
    if (yaml && !document) throw new Error(`DSL 链接缺少规则文档：${source} -> ${target}`);
    if (!document) return link.url;
    const fragment = document.fragments.find((item) =>
      yaml ? item.id === link.fragment : item.kind === "section" && item.anchor === link.fragment,
    );
    if (fragment) return ruleLink(document.id, fragment.id);
    if (!link.fragment && document.fragments.length && !exportPath.startsWith("hooks/"))
      return ruleLink(document.id);
    if (yaml && link.fragment && ![...document.sectionIds.values()].includes(link.fragment)) {
      throw new Error(`DSL 链接缺少规则片段：${source} -> ${target}`);
    }
    const original = new URL(link.url);
    const rule = pathToFileURL(resolve(catalog.root, catalog.references.sourceForPath(exportPath)!));
    rule.search = original.search;
    rule.hash = yaml ? original.hash : (document.sectionIds.get(link.fragment) ?? original.hash);
    return rule.href;
  });
}

export function resolveHookLink(root: string, hook: HookId, target: string): string {
  const link = resolveDocumentLink(root, `hooks/${hook}.md`, target);
  if (!link) throw new Error(`不是本地来源链接：${target}`);
  return link.path;
}
