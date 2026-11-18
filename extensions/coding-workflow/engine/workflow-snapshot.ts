import { randomUUID } from "node:crypto";
import { SIGNALS, type Catalog } from "../catalog.ts";
import { validateAnswers } from "../startup.ts";
import {
  EPOCH_DIMENSIONS,
  hasText,
  ROLES,
  type State,
  type WorkflowSession,
  type WorkflowTask,
} from "../host/session-state.ts";

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
    version: 2,
    sessionId,
    cwd,
    catalogHash: catalog.digest,
    runId: randomUUID(),
    mode,
    childCount,
    task,
    revision: 0,
    status: "active",
    reason: "",
    epoch: { content: 0, documentation: 0, git: 0 },
    observations: [],
    allocations: [],
    inFlight: [],
    signals: [],
  };
}

function hasValidBudget({ mode, childCount }: WorkflowTask): boolean {
  return mode === "single" ? childCount === 0 : childCount >= 1;
}

function hasValidEpoch(state: Pick<State, "epoch">): boolean {
  const { epoch } = state;
  return (
    Boolean(epoch) &&
    Object.values(epoch).length === EPOCH_DIMENSIONS.length &&
    EPOCH_DIMENSIONS.every((dimension) => Number.isSafeInteger(epoch[dimension]) && epoch[dimension] >= 0)
  );
}

function validateAllocations(state: Pick<State, "allocations" | "childCount">): void {
  const roles = new Set(state.allocations.map((slot) => slot.role));
  const ids = new Set(state.allocations.map((slot) => slot.id));
  if (
    state.allocations.length > state.childCount ||
    roles.size !== state.allocations.length ||
    ids.size !== roles.size ||
    state.allocations.some(
      ({ id, callId, role, status }) =>
        !hasText(id) ||
        !hasText(callId) ||
        !ROLES.includes(role) ||
        !["running", "completed", "failed", "uncertain"].includes(status),
    )
  ) {
    throw new Error("allocation 无效");
  }
}

type SavedState = Omit<State, "version" | "status"> & {
  version: number;
  status: State["status"] | "blocked";
  phase?: unknown;
  step?: unknown;
};

function boundSnapshot(data: unknown, session: WorkflowSession): SavedState {
  const state = data as SavedState;
  if (
    !state ||
    ![1, 2].includes(state.version) ||
    state.sessionId !== session.sessionId ||
    state.cwd !== session.cwd ||
    !hasText(state.runId) ||
    !hasText(state.catalogHash)
  ) {
    throw new Error("会话快照版本、身份或目录不匹配");
  }
  return state;
}

function validateSnapshot(state: SavedState): void {
  validateAnswers({ mode: state.mode, count: state.childCount, audit: state.audit });
  if (
    !hasValidBudget(state) ||
    !hasValidEpoch(state) ||
    !hasText(state.task, 8000) ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < 0 ||
    !["active", "paused", "blocked", "complete"].includes(state.status) ||
    typeof state.reason !== "string"
  ) {
    throw new Error("工作流快照结构无效");
  }
}

function validateActivity(state: SavedState): void {
  for (const field of ["observations", "allocations", "inFlight", "signals"] as const) {
    if (!Array.isArray(state[field]) || state[field].length > 256) throw new Error("无效状态字段：" + field);
  }
  validateAllocations(state);
  if (
    state.inFlight.some((id) => !hasText(id)) ||
    state.signals.some((signal) => !SIGNALS.includes(signal))
  ) {
    throw new Error("会话效果或触发记录无效");
  }
}

function recoveryHint(state: SavedState, changed: boolean): string | undefined {
  const hints: string[] = [];
  if (changed) hints.push("规则或扩展版本变化，按当前合同重核受影响事实");
  if (hasText(state.phase, 32) && Number.isSafeInteger(state.step)) {
    hints.push(`旧路线位置 ${state.phase}/${String(state.step)}，仅供读回参考`);
  } else if (hasText(state.recoveryHint, 4096)) {
    hints.push(state.recoveryHint);
  }
  return hints.join("。") || undefined;
}

export function restoreState(catalog: Catalog, data: unknown, session: WorkflowSession): State {
  const state = boundSnapshot(data, session);
  validateSnapshot(state);
  validateActivity(state);
  const {
    sessionId,
    cwd,
    runId,
    mode,
    childCount,
    task,
    audit,
    revision,
    reason,
    epoch,
    allocations,
    inFlight,
  } = state;
  const changed = state.catalogHash !== catalog.digest;
  return structuredClone({
    version: 2,
    catalogHash: catalog.digest,
    sessionId,
    cwd,
    runId,
    mode,
    childCount,
    task,
    audit,
    revision,
    reason,
    epoch,
    allocations,
    inFlight,
    status: state.status === "complete" ? "complete" : "paused",
    signals: [],
    observations: changed || state.version === 1 ? [] : state.observations,
    recoveryHint: recoveryHint(state, changed),
  });
}
