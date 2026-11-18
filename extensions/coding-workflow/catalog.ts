import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadReferenceData } from "./reference-data.ts";

export const RULES_ROOT = fileURLToPath(new URL("../../docs/rules/", import.meta.url));
export { headingSlug } from "./reference-data.ts";
export {
  documentLinks,
  mapDocumentLinks,
  resolveDocumentLink,
  resolveHookLink,
  rewriteDocumentLinks,
  rewriteWorkflowLinks,
  ruleLink,
} from "./rules/document-links.ts";
export const WORKFLOW_DIR = "coding-workflows";
const WORKFLOW_SOURCES = [
  "catalog.ts",
  "checkpoint-evidence.ts",
  "delegation.ts",
  "engine.ts",
  "engine/checkpoint-progress.ts",
  "engine/workflow-execution.ts",
  "engine/workflow-recovery.ts",
  "engine/workflow-snapshot.ts",
  "host/runtime-session.ts",
  "host/session-restore.ts",
  "host/tool-events.ts",
  "host/turn-events.ts",
  "host/workflow-commands.ts",
  "index.ts",
  "model-selection.ts",
  "reference-data.ts",
  "rules/blocks.ts",
  "rules/document-links.ts",
  "rules/fragments.ts",
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
interface StageHook {
  phase: Phase;
  name: string;
  anchors: readonly string[];
}

// 宿主守卫和续接只依赖这些锚点。其余检查点及执行要求均由 Hook 提供。
const STAGE_HOOKS: Partial<Record<HookId, StageHook>> = {
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

function hashSources() {
  const hash = createHash("sha256");
  for (const file of WORKFLOW_SOURCES) {
    hash.update(file).update(readFileSync(new URL(file, import.meta.url)));
  }
  return hash;
}

function readHookActivation(references: Catalog["references"], hook: HookId): HookTrigger[] {
  const activation = references.hookActivation(hook);
  if (
    !Array.isArray(activation) ||
    !activation.length ||
    new Set(activation).size !== activation.length ||
    activation.some((item) => !HOOK_TRIGGERS.includes(item))
  ) {
    throw new Error(`Hook ${hook} 的 activate_on 缺失或包含无效触发条件`);
  }
  return activation;
}

function readStageModule(references: Catalog["references"], hook: HookId, binding: StageHook): Module {
  const documentId = hookDocument(hook);
  const document = references.document(documentId);
  const checkpoints = document.fragments
    .filter((item) => item.kind === "checkpoint")
    .map(({ id, title, applicability }) => ({
      id,
      title,
      applicability,
      get instruction() {
        return references.readFragment(documentId, id);
      },
    }));
  const anchors = checkpoints.filter(({ id }) => binding.anchors.includes(id)).map(({ id }) => id);
  const invalidApplicability = checkpoints.some(
    ({ id, applicability }) =>
      applicability === "sub_agent" && (hook !== "delegation" || id === "DE02" || id === "DE04"),
  );
  if (!checkpoints.length || anchors.join() !== binding.anchors.join() || invalidApplicability) {
    throw new Error(`检查点契约变化，须核对宿主守卫锚点：${document.path}`);
  }
  return { name: binding.name, hook, path: document.path, checkpoints };
}

function indexHooks(references: Catalog["references"]) {
  const modules: Record<string, Module> = Object.create(null);
  const hookTriggers = {} as Catalog["hookTriggers"];
  for (const hook of HOOK_IDS) {
    hookTriggers[hook] = readHookActivation(references, hook);
    const binding = STAGE_HOOKS[hook];
    if (binding) modules[binding.name] = readStageModule(references, hook, binding);
  }
  return { modules, hookTriggers };
}

export function loadCatalog(root = RULES_ROOT): Catalog {
  const hash = hashSources();
  const references = loadReferenceData(root);
  hash.update("rules-yaml").update(references.digest);
  const { modules, hookTriggers } = indexHooks(references);
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

export function hookDocument(id: HookId): string {
  return `hook-${id}`;
}
