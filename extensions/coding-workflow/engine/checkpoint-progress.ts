import { currentModule, type Catalog, type Checkpoint, type Phase } from "../catalog.ts";
import { applyCheckpointEvidence } from "../checkpoint-evidence.ts";
import {
  hasCurrentContentAndDocumentation,
  hasText,
  pauseWorkflow,
  requireEvidence,
  revokeSlice,
  sameEpoch,
  WORKFLOW_HISTORY_LIMIT,
  type CheckReport,
  type State,
} from "../workflow-state.ts";

export function currentCheckpoint(catalog: Catalog, state: State): Checkpoint | undefined {
  return currentModule(catalog, state.phase, state.mode).checkpoints[state.step];
}

export function isApplicable(state: State, checkpoint: Checkpoint): boolean {
  return checkpoint.applicability !== "sub_agent" || state.execution?.executor !== "root";
}

function position(catalog: Catalog, mode: State["mode"], target: { phase: Phase; checkpoint?: string }) {
  const { phase, checkpoint } = target;
  const step =
    checkpoint === undefined
      ? 0
      : currentModule(catalog, phase, mode).checkpoints.findIndex((item) => item.id === checkpoint);
  if (step < 0) throw new Error(`无法找到检查点 ${checkpoint}`);
  return { phase, step };
}

export function moveTo(catalog: Catalog, state: State, target: { phase: Phase; checkpoint?: string }): void {
  Object.assign(state, position(catalog, state.mode, target));
}

function reverify(
  catalog: Catalog,
  state: State,
  target: { phase: "documentation" | "delivery"; checkpoint: string },
): void {
  state.returnTo = position(catalog, state.mode, target);
  state.checked = undefined;
  revokeSlice(state);
  moveTo(catalog, state, { phase: "verification" });
}

export function recheckBeforeGit(catalog: Catalog, state: State): void {
  if (
    state.phase === "delivery" &&
    currentCheckpoint(catalog, state)?.id === "DA02" &&
    !hasCurrentContentAndDocumentation(state)
  ) {
    reverify(catalog, state, { phase: "delivery", checkpoint: "DA02" });
  }
}

function resumeDecision(catalog: Catalog, state: State, target: NonNullable<State["decisionReturn"]>): void {
  state.decisionReturn = undefined;
  state.signals = state.signals.filter(
    (signal) => signal !== "decision_required" && signal !== "requirements_changed",
  );
  moveTo(catalog, state, target);
  recheckBeforeGit(catalog, state);
}

function finishDecision(catalog: Catalog, state: State): boolean {
  const target = state.decisionReturn;
  if (!target) return false;
  if (state.phase === "definition") {
    resumeDecision(catalog, state, target);
    return true;
  }
  if (state.phase !== "entry") return false;
  const revisitDefinition = target.phase === "definition" && ["WD00", "WD01"].includes(target.checkpoint);
  if (target.phase === "session" || revisitDefinition) {
    resumeDecision(catalog, state, target);
  } else {
    moveTo(catalog, state, { phase: "definition", checkpoint: "WD01" });
  }
  return true;
}

function advancePhase(catalog: Catalog, state: State): void {
  revokeSlice(state);
  state.signals = [];
  if (finishDecision(catalog, state)) return;
  if (state.phase === "execution") state.execution = undefined;
  if (state.phase === "verification") {
    state.verified = structuredClone(state.checked);
    if (state.returnTo) {
      Object.assign(state, state.returnTo);
      state.returnTo = undefined;
      return;
    }
  }
  if (state.phase === "documentation" && !sameEpoch(state.verified, state.epoch)) {
    reverify(catalog, state, { phase: "documentation", checkpoint: "DOC04" });
    return;
  }
  advanceRoute(catalog, state);
}

function advanceRoute(catalog: Catalog, state: State): void {
  const phases = catalog.routes[state.mode].phases;
  const next = phases[phases.indexOf(state.phase) + 1];
  if (!next) {
    state.status = "complete";
    state.reason = "结构化门禁已完成；语义验收仍以报告的真实证据为准";
    return;
  }
  moveTo(catalog, state, { phase: next });
  if (next === "verification") state.checked = undefined;
}

function validateReport(
  state: State,
  step: Checkpoint | undefined,
  report: CheckReport,
): asserts step is Checkpoint {
  if (!step || report.checkpoint !== step.id) throw new Error(`当前检查点是 ${step?.id}，不能跳步`);
  if (
    !hasText(report.summary) ||
    !["complete", "not_applicable", "needs_prerequisite", "blocked"].includes(report.outcome)
  ) {
    throw new Error("结果/有界证据摘要无效");
  }
  requireEvidence(state, report.evidence);
  if (report.outcome === "not_applicable" && !step.applicability) {
    throw new Error(`${step.id} 是必需检查点，不能整体 N/A`);
  }
}

function deliveryReview(state: State, id: string, last: boolean): string | undefined {
  if (id === "DA01") return hasCurrentContentAndDocumentation(state) ? undefined : id;
  const beforeAcceptance = id === "DA03" || id === "DA04" || (state.phase === "delivery" && last);
  return beforeAcceptance && !sameEpoch(state.verified, state.epoch) ? "DA03" : undefined;
}

function returnToVerification(
  catalog: Catalog,
  state: State,
  { id, last }: { id: string; last: boolean },
): boolean {
  if (last && state.phase === "verification" && !sameEpoch(state.checked, state.epoch)) {
    state.checked = undefined;
    moveTo(catalog, state, { phase: "verification", checkpoint: "VR01" });
    return true;
  }
  const deliveryCheckpoint = deliveryReview(state, id, last);
  if (deliveryCheckpoint) {
    // Git 或计划归档效果已经发生时，只补当前验证和验收证据。
    reverify(catalog, state, { phase: "delivery", checkpoint: deliveryCheckpoint });
    return true;
  }
  if (id === "DOC04" && state.verified?.content !== state.epoch.content) {
    reverify(catalog, state, { phase: "documentation", checkpoint: id });
    return true;
  }
  return false;
}

function assertPhaseExit(state: State, last: boolean): void {
  const { phase, plan } = state;
  if (!last || (phase !== "verification" && phase !== "delivery")) return;
  const unsettled = state.allocations.some(({ status }) => status === "running" || status === "uncertain");
  if (state.inFlight.length || unsettled) throw new Error("仍有结果不明的操作，不能完成验证或验收");
  if (phase === "delivery" && plan !== "archived" && plan !== "prohibited") {
    throw new Error("交付完成前须有已归档的计划或适用的持久化限制");
  }
}

function appendReport(state: State, report: CheckReport, checkpoints: Checkpoint[]): void {
  applyCheckpointEvidence(state, report);
  const entry: State["reports"][number] = {
    phase: state.phase,
    epoch: structuredClone(state.epoch),
    report: structuredClone(report),
  };
  if (report.checkpoint === "DE02" && state.execution?.executor === "root") {
    entry.notApplicable = checkpoints.filter((item) => !isApplicable(state, item)).map((item) => item.id);
  }
  state.reports.push(entry);
  state.reports = state.reports.slice(-WORKFLOW_HISTORY_LIMIT);
}

function nextApplicable(state: State, checkpoints: Checkpoint[]): Checkpoint | undefined {
  for (let step = state.step + 1; step < checkpoints.length; step++) {
    if (!isApplicable(state, checkpoints[step])) continue;
    state.step = step;
    return checkpoints[step];
  }
  state.step = checkpoints.length;
  return undefined;
}

function advanceAfterReport(
  catalog: Catalog,
  state: State,
  { completed, next }: { completed: string; next?: Checkpoint },
): void {
  const target = state.decisionReturn;
  if (state.phase === "definition" && target) {
    const reachedTarget = target.phase === "definition" && next?.id === target.checkpoint;
    if (reachedTarget || (completed === "WD02" && state.plan === "archived")) {
      resumeDecision(catalog, state, target);
      return;
    }
  }
  if (!next) advancePhase(catalog, state);
}

function applyReport(catalog: Catalog, state: State, report: CheckReport): void {
  const { checkpoints } = currentModule(catalog, state.phase, state.mode);
  const step: Checkpoint | undefined = checkpoints[state.step];
  validateReport(state, step, report);
  if (report.outcome === "needs_prerequisite" || report.outcome === "blocked") {
    pauseWorkflow(state, report.summary);
    if (report.outcome === "blocked") state.status = "blocked";
    return;
  }
  const last = state.step === checkpoints.length - 1;
  if (!returnToVerification(catalog, state, { id: step.id, last })) {
    assertPhaseExit(state, last);
    appendReport(state, report, checkpoints);
    advanceAfterReport(catalog, state, { completed: step.id, next: nextApplicable(state, checkpoints) });
  }
  state.revision++;
  state.progress++;
}

function assertBatchContinuation(
  state: State,
  origin: Pick<State, "phase" | "step" | "decisionReturn">,
): void {
  if (state.status !== "active") throw new Error("暂停或阻断必须是批次末项");
  if (origin.decisionReturn !== undefined && !state.decisionReturn) {
    throw new Error("批次不能跨越决策补证的返回位置；先核对原检查点");
  }
  if (state.phase === origin.phase && state.step <= origin.step) {
    throw new Error("批次须止于重核入口；先检查当前状态");
  }
}

export function reportCheckpoints(catalog: Catalog, state: State, reports: CheckReport[]): State {
  if (!Array.isArray(reports) || reports.length < 1 || reports.length > 10) {
    throw new Error("一次提交1至10项同模块检查点结果");
  }
  // 整批检查通过后才替换会话状态，后续项失败时可保留原位置。
  const trial = structuredClone(state);
  for (const [index, report] of reports.entries()) {
    if (trial.phase !== state.phase) throw new Error("批次不能跨模块；先消费下一模块 Hooks");
    const origin = { phase: trial.phase, step: trial.step, decisionReturn: trial.decisionReturn };
    applyReport(catalog, trial, report);
    if (index < reports.length - 1) assertBatchContinuation(trial, origin);
  }
  return trial;
}
