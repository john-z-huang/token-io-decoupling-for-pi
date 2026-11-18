import { randomUUID } from "node:crypto";
import { currentModule, SIGNALS, type Catalog } from "../catalog.ts";
import { validateAnswers } from "../startup.ts";
import {
  EPOCH_DIMENSIONS,
  hasText,
  ROLES,
  type State,
  type WorkflowSession,
  type WorkflowTask,
} from "../workflow-state.ts";

export function makeState(catalog: Catalog, session: WorkflowSession, request: WorkflowTask): State {
  const { sessionId, cwd } = session;
  const { mode, childCount, task } = request;
  if (!hasText(sessionId) || !hasText(cwd, 4096) || !hasText(task, 8000)) {
    throw new Error("会话、目录与任务必须明确");
  }
  if (!["single", "multi"].includes(mode) || !Number.isSafeInteger(childCount) || !hasValidBudget(request)) {
    throw new Error("模式与子代理数量不一致");
  }
  return {
    version: 1,
    sessionId,
    cwd,
    catalogHash: catalog.digest,
    runId: randomUUID(),
    mode,
    childCount,
    task,
    phase: catalog.routes[mode].phases[0],
    step: 0,
    revision: 0,
    progress: 0,
    status: "active",
    reason: "",
    epoch: { content: 0, documentation: 0, git: 0 },
    reports: [],
    observations: [],
    allocations: [],
    inFlight: [],
    signals: [],
    plan: "pending",
    independence: "unknown",
    autoTurns: 0,
    lastNudge: -1,
  };
}

function hasValidBudget({ mode, childCount }: WorkflowTask): boolean {
  return mode === "single" ? childCount === 0 : childCount >= 1;
}

function hasValidEpoch(state: State): boolean {
  const { epoch } = state;
  return (
    Boolean(epoch) &&
    Object.values(epoch).length === EPOCH_DIMENSIONS.length &&
    EPOCH_DIMENSIONS.every((dimension) => Number.isSafeInteger(epoch[dimension]) && epoch[dimension] >= 0)
  );
}

function validateProgress(catalog: Catalog, state: State): void {
  const integers = [state.childCount, state.step, state.revision, state.progress, state.autoTurns];
  const phases = catalog.routes[state.mode].phases;
  if (
    integers.some((value) => !Number.isSafeInteger(value) || value < 0) ||
    !phases.includes(state.phase) ||
    !["active", "paused", "blocked", "complete"].includes(state.status) ||
    !hasText(state.task, 8000)
  ) {
    throw new Error("工作流快照结构无效");
  }
  if (!hasValidBudget(state) || !hasValidEpoch(state)) throw new Error("数量或 epoch 无效");
}

function validateHistory(state: State): void {
  for (const field of ["reports", "observations", "allocations", "inFlight", "signals"] as const) {
    if (!Array.isArray(state[field]) || state[field].length > 256) throw new Error(`状态字段 ${field} 无效`);
  }
  const { allocations } = state;
  const roles = allocations.map((allocation) => allocation.role);
  const invalidAllocation = allocations.some(
    ({ role, status }) =>
      !ROLES.includes(role) || !["running", "completed", "failed", "uncertain"].includes(status),
  );
  if (allocations.length > state.childCount || new Set(roles).size !== roles.length || invalidAllocation) {
    throw new Error("allocation 无效");
  }
}

function validatePosition(catalog: Catalog, state: State): void {
  const length = currentModule(catalog, state.phase, state.mode).checkpoints.length;
  const finalPhase = catalog.routes[state.mode].phases.at(-1);
  const reachable =
    state.status === "complete" ? state.phase === finalPhase && state.step === length : state.step < length;
  if (!reachable) throw new Error("检查点位置越界或终态不一致");
}

function validateDecisions(state: State): void {
  if (
    !state.signals.every((signal) => SIGNALS.includes(signal)) ||
    !["pending", "persisted", "prohibited", "archived"].includes(state.plan) ||
    !["unknown", "required", "not_required"].includes(state.independence)
  ) {
    throw new Error("状态枚举无效");
  }
  const { execution } = state;
  if (!execution) return;
  const { executor, roleConfirmed } = execution;
  const roleApplies = roleConfirmed === undefined || (executor === "sub_agent" && roleConfirmed === true);
  if (state.mode !== "multi" || !["root", "sub_agent"].includes(executor) || !roleApplies) {
    throw new Error("执行者选择记录无效");
  }
}

function validateDecisionReturn(catalog: Catalog, state: State): void {
  const { decisionReturn, mode } = state;
  if (!decisionReturn) return;
  const { phase, checkpoint } = decisionReturn;
  const validPhase = phase !== "entry" && catalog.routes[mode].phases.includes(phase);
  if (
    !validPhase ||
    !currentModule(catalog, phase, mode).checkpoints.some((item) => item.id === checkpoint)
  ) {
    throw new Error("决策补证返回位置无效");
  }
}

function validateVerificationReturn(catalog: Catalog, state: State): void {
  const { returnTo, mode } = state;
  if (!returnTo) return;
  const { phase, step } = returnTo;
  const validPhase = phase === "documentation" || phase === "delivery";
  const index = Number.isSafeInteger(step) && step >= 0;
  if (!validPhase || !index || step >= currentModule(catalog, phase, mode).checkpoints.length) {
    throw new Error("验证返回位置无效");
  }
}

// 恢复时核对当前会话和规则指纹，再逐组验证持久化字段。
export function restoreState(catalog: Catalog, data: unknown, session: WorkflowSession): State {
  const state = data as State;
  if (
    !state ||
    state.version !== 1 ||
    state.sessionId !== session.sessionId ||
    state.cwd !== session.cwd ||
    state.catalogHash !== catalog.digest
  ) {
    throw new Error("工作流状态版本、Session、目录或规则 Hash 不匹配；须人工重核，不能套用旧状态");
  }
  validateAnswers({ mode: state.mode, count: state.childCount, audit: state.audit });
  validateProgress(catalog, state);
  validateHistory(state);
  validatePosition(catalog, state);
  validateDecisions(state);
  validateDecisionReturn(catalog, state);
  validateVerificationReturn(catalog, state);
  return structuredClone(state);
}
