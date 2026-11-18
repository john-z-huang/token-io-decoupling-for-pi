import { SIGNALS, type Catalog } from "../catalog.ts";
import { currentCheckpoint, moveTo, recheckBeforeGit } from "./checkpoint-progress.ts";
import { hasText, recordMutation, revokeSlice, type State, type WorkflowSignal } from "../workflow-state.ts";

function hasReadback(state: State, evidence: string[], after: number): boolean {
  return state.observations.some(
    (observation) =>
      evidence.includes(observation.id) &&
      observation.ok &&
      ["read", "check"].includes(observation.effect) &&
      observation.revision > after,
  );
}

export function resumeWorkflow(catalog: Catalog, state: State, evidence: string[]): void {
  if (state.status === "complete") throw new Error("已完成任务不能通过 resume 隐式新建任务");
  if (state.inFlight.length) {
    throw new Error("存在结果不明操作，先使用 resolve_effect 结合当前实际读回证据处置");
  }
  if (!hasReadback(state, evidence, state.pauseRevision ?? -1)) {
    throw new Error("恢复前须有暂停后实际读回/检查的证据");
  }
  state.status = "active";
  state.reason = "";
  revokeSlice(state);
  recheckBeforeGit(catalog, state);
  state.revision++;
}

export function resolveUnknownEffect(state: State, callId: string, evidence: string[]): void {
  const hasEvidence = state.observations.some(
    ({ id, ok, effect }) => evidence.includes(id) && ok && ["read", "check"].includes(effect),
  );
  if (!state.inFlight.includes(callId) || !hasEvidence) {
    throw new Error("须引用实际读回/检查来处置已知的结果不明操作");
  }
  state.inFlight = state.inFlight.filter((id) => id !== callId);
  for (const slot of state.allocations) {
    if (slot.callId === callId && slot.status === "uncertain") slot.status = "failed";
  }
  state.revision++;
}

function canRecheckExecutor(state: State): boolean {
  return (
    state.mode === "multi" &&
    state.phase === "execution" &&
    Boolean(state.execution) &&
    !state.inFlight.length
  );
}

function validateSignal(state: State, { signal, reason }: WorkflowSignal): void {
  if (state.status === "complete") throw new Error("终态不能隐式修改任务；由用户明确开始新任务");
  if (!SIGNALS.includes(signal) || !hasText(reason)) throw new Error("语义信号或说明无效");
  if (signal === "repair_required" && state.phase !== "verification") {
    throw new Error("修复信号只能从验证边界进入；Contract 变化先上报 requirements_changed");
  }
  if (signal === "executor_changed" && !canRecheckExecutor(state)) {
    throw new Error("执行者重核须在已有选择的多代理执行模块，且当前效果已读回");
  }
}

function requireCheckpointId(catalog: Catalog, state: State): string {
  const checkpoint = currentCheckpoint(catalog, state);
  if (!checkpoint) throw new Error("当前工作流缺少可核验的检查点");
  return checkpoint.id;
}

function restartContract(catalog: Catalog, state: State): void {
  if (state.phase !== "entry") {
    state.decisionReturn ??= { phase: state.phase, checkpoint: requireCheckpointId(catalog, state) };
  }
  revokeSlice(state);
  state.checked = undefined;
  state.verified = undefined;
  state.independence = "unknown";
  // Contract 变化影响验收与计划适用性。已发生的归档仍保留在报告历史。
  state.plan = "pending";
  recordMutation(state, "content");
  moveTo(catalog, state, { phase: "entry" });
}

function reopenDecision(catalog: Catalog, state: State): void {
  const { phase } = state;
  const checkpoint = requireCheckpointId(catalog, state);
  if (phase !== "entry" && phase !== "session" && checkpoint !== "WD00") {
    if (checkpoint !== "WD01") state.decisionReturn ??= { phase, checkpoint };
    moveTo(catalog, state, { phase: "definition", checkpoint: "WD01" });
  }
  revokeSlice(state);
  state.checked = undefined;
}

function applySignal(catalog: Catalog, state: State, signal: WorkflowSignal["signal"]): void {
  switch (signal) {
    case "requirements_changed":
      return restartContract(catalog, state);
    case "decision_required":
      return reopenDecision(catalog, state);
    case "capability_changed":
      return revokeSlice(state);
    case "executor_changed":
      revokeSlice(state);
      state.execution = undefined;
      moveTo(catalog, state, { phase: "execution", checkpoint: "DE02" });
      return;
    case "repair_required":
      moveTo(catalog, state, { phase: "execution" });
      revokeSlice(state);
      state.execution = undefined;
      // 修复保留文档或交付的续接位置，执行完成后回到验证。
      return;
    case "documentation_impact":
      return recordMutation(state, "content");
    case "git_changed":
      return recordMutation(state, "git");
  }
}

export function recordSignal(catalog: Catalog, state: State, request: WorkflowSignal): void {
  validateSignal(state, request);
  const { signal } = request;
  if (!state.signals.includes(signal)) state.signals.push(signal);
  applySignal(catalog, state, signal);
  state.revision++;
  state.progress++;
}
