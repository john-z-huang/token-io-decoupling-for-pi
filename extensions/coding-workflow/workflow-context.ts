import {
  currentModule,
  HOOK_IDS,
  hookDocument,
  rewriteWorkflowLinks,
  ruleLink,
  type Catalog,
  type HookId,
  type HookTrigger,
  type Mode,
} from "./catalog.ts";
import type { Workflow } from "./engine.ts";
import type { State } from "./workflow-state.ts";

export const MAX_CONTEXT = 96000;
const OBSERVATIONS_PER_PAGE = 24;
const REQUIRED_HOOK_RULES: Partial<Record<HookId, string>> = {
  verification: "verification-epoch#actions",
};
const CONTEXT_INSTRUCTIONS = [
  "[Coding Extension：结构化流程，不是权限或事实证明]",
  "用 coding_checkpoint 上报已完成项及真实证据；同模块连续项可在读过各项指令后批量提交。语义变化用 signal，缺前置用 pause/blocked。恢复后从原位推进。facts 由 Agent 提供，须有来源。",
  "用 coding_checkpoint 的 rules 动作查询规则。coding-rule:文档#片段 对应 document 和 fragment；省略 fragment 可列出片段，省略 document 默认为当前阶段的 Hook。",
  "写前用 coding_slice 放行四字段和精确文件。Bash、codemode 和不透明 MCP 经 coding_run 声明 effect/rationale/evidence，先核验实际效果和授权。子任务只经 coding_delegate，禁止递归和其他入口绕过。",
];

function renderFragment(catalog: Catalog, documentId: string, fragment: string): string {
  const document = catalog.references.document(documentId);
  const body = catalog.references.readFragment(document.id, fragment);
  return rewriteWorkflowLinks(catalog, document.path, body);
}

// 规则来源对照保留在链接文档中，避免把维护信息混入执行合同。
export function renderHook(catalog: Catalog, hook: HookId, mode: Mode): string {
  const template = rewriteWorkflowLinks(catalog, `hooks/${hook}.md`, catalog.references.readHook(hook));
  const required = REQUIRED_HOOK_RULES[hook];
  if (required && !template.split("\n").includes(`<!-- rule:${required} -->`)) {
    throw new Error(`Hook ${hook} 缺少必需规则片段：${required}`);
  }
  const body = template.replace(
    /^<!-- rule:([a-z][a-z0-9-]*)#([A-Za-z][A-Za-z0-9-]*) -->$/gm,
    (_marker, owner: string, fragment: string) => renderFragment(catalog, owner, fragment),
  );
  if (hook !== "entry") return `[Hook:${hook}]\n\n${body}`;

  const route = catalog.routes[mode].documentId;
  const modeBoundary = renderFragment(catalog, route, "mode-boundary");
  return `[Hook:${hook}]\n\n${body}\n\n## 当前路线的 Mode 边界\n\n${modeBoundary}`;
}

function hasRecoveryPosition(state: State): boolean {
  return (
    state.status === "paused" || state.status === "blocked" || Boolean(state.returnTo || state.decisionReturn)
  );
}

function activationTriggers(workflow: Workflow, hook: HookId): Set<HookTrigger> {
  const { state, checkpoint } = workflow;
  const checkpointId = checkpoint?.id;
  const triggers = new Set<HookTrigger>(["workflow", state.phase, ...state.signals]);
  const atIndependentCheck = checkpointId === "VR02";
  const auditAllocation = state.allocations.some(
    (allocation) =>
      allocation.status === "running" ||
      allocation.status === "uncertain" ||
      (atIndependentCheck && allocation.role === "Change Verification"),
  );

  if (hook === "delegation") triggers.add("multi_execution");
  if (hasRecoveryPosition(state) || state.inFlight.length > 0) triggers.add("recovery_needed");
  if (checkpointId === "VR05") triggers.add("repair_review");
  if (atIndependentCheck && state.mode === "multi" && state.independence === "required") {
    triggers.add("independent_verification");
  }
  if (auditAllocation) triggers.add("active_allocation");
  return triggers;
}

function activeHooks(workflow: Workflow): HookId[] {
  const { state, catalog } = workflow;
  const { hook } = currentModule(catalog, state.phase, state.mode);
  const triggers = activationTriggers(workflow, hook);
  const primaryHook = hook === "delegation" && state.execution?.executor === "root" ? "execution" : hook;
  return HOOK_IDS.filter(
    (id) => id === primaryHook || catalog.hookTriggers[id].some((trigger) => triggers.has(trigger)),
  );
}

function renderPosition(workflow: Workflow): string[] {
  const { state, catalog, checkpoint } = workflow;
  const route = catalog.routes[state.mode];
  const sections: string[] = [];
  if (checkpoint) {
    const routeStep = route.steps[state.phase];
    const module = currentModule(catalog, state.phase, state.mode);
    const routeLink = ruleLink(route.documentId, routeStep.id);
    const checkpointLink = ruleLink(hookDocument(module.hook), checkpoint.id);
    sections.push(
      `当前路线 [${routeStep.id} ${routeStep.title}](${routeLink})\n${renderFragment(catalog, route.documentId, routeStep.id)}`,
      `当前检查点 [${checkpoint.id} ${checkpoint.title}](${checkpointLink})\n${rewriteWorkflowLinks(catalog, module.path, checkpoint.instruction)}`,
    );
  }
  if (hasRecoveryPosition(state)) {
    sections.push(`[当前路线的前置返回映射](${ruleLink(route.documentId, "returns")})`);
  }
  return sections;
}

function renderUpcomingCheckpoints(workflow: Workflow): string[] {
  if (!workflow.checkpoint) return [];
  const { catalog, state } = workflow;
  const module = currentModule(catalog, state.phase, state.mode);
  const upcoming = module.checkpoints.slice(state.step + 1).filter((item) => workflow.isApplicable(item));
  if (!upcoming.length) return [];
  const titles = upcoming.map((item) => `${item.id} ${item.title}`).join("\n");
  return [`[当前阶段后续检查点](${ruleLink(hookDocument(module.hook))})\n${titles}`];
}

export function renderContext(workflow: Workflow): string {
  const { state, catalog, checkpoint } = workflow;
  const contextState = {
    revision: state.revision,
    status: state.status,
    reason: state.reason,
    mode: state.mode,
    child_count: state.childCount,
    audit: state.audit,
    phase: state.phase,
    checkpoint: checkpoint?.id ?? "done",
    epoch: state.epoch,
    verified: state.verified,
    returnTo: state.returnTo,
    decisionReturn: state.decisionReturn,
    executor: state.execution?.executor,
    plan: state.plan,
    allocations: state.allocations,
    inFlight: state.inFlight,
    slice: state.slice,
    task: state.task,
  };
  const recentObservations = state.observations.slice(-OBSERVATIONS_PER_PAGE);
  const sections = [
    ...CONTEXT_INSTRUCTIONS,
    ...activeHooks(workflow).map((hook) => renderHook(catalog, hook, state.mode)),
    JSON.stringify(contextState),
    ...renderPosition(workflow),
    ...renderUpcomingCheckpoints(workflow),
    `可引用的最近24项实际观察（更早引用可通过 status 查找；被128项窗口淘汰的证据须重读）：\n${JSON.stringify(recentObservations)}`,
  ];
  if (!checkpoint) sections.push("已完成结构化检查点，向用户报告实际验收结果和限制。");

  const content = sections.join("\n\n");
  if (content.length > MAX_CONTEXT) {
    throw new Error(`当前规则包超出${MAX_CONTEXT}字符上限；停止依赖工作，请缩小任务/规则，而不是截断守卫`);
  }
  return content;
}

export function workflowStatus(workflow: Workflow, offset?: number) {
  const { state, checkpoint } = workflow;
  const observationCount = state.observations.length;
  const start = offset ?? Math.max(0, observationCount - OBSERVATIONS_PER_PAGE);
  const end = start + OBSERVATIONS_PER_PAGE;
  const recentReports = state.reports.slice(-2).map(({ report, epoch, notApplicable }) => ({
    checkpoint: report.checkpoint,
    epoch,
    notApplicable,
  }));

  return {
    runId: state.runId,
    revision: state.revision,
    status: state.status,
    reason: state.reason,
    mode: state.mode,
    childCount: state.childCount,
    audit: state.audit,
    phase: state.phase,
    step: state.step,
    next: checkpoint?.id ?? "done",
    epoch: state.epoch,
    verified: state.verified,
    returnTo: state.returnTo,
    plan: state.plan,
    allocations: state.allocations,
    inFlight: state.inFlight,
    slice: state.slice,
    executor: state.execution?.executor,
    decisionReturn: state.decisionReturn,
    observationCount,
    observationsOffset: start,
    nextObservationsOffset: end < observationCount ? end : null,
    observations: state.observations.slice(start, end),
    recentReports,
    hooks: activeHooks(workflow),
  };
}
