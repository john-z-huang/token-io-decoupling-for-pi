import { sameEpoch, type CheckReport, type Observation, type State } from "./workflow-state.ts";

function hasSuccessfulEffect(
  state: State,
  evidence: string[],
  expected: { effect: Observation["effect"]; contentEpoch?: number },
): boolean {
  return state.observations.some(
    (observation) =>
      evidence.includes(observation.id) &&
      observation.ok &&
      observation.effect === expected.effect &&
      (expected.contentEpoch === undefined || observation.epoch.content === expected.contentEpoch),
  );
}

function hasCurrentCheck(state: State, evidence: string[]): boolean {
  return state.observations.some(
    (observation) =>
      evidence.includes(observation.id) &&
      observation.effect === "check" &&
      observation.ok &&
      sameEpoch(observation.epoch, state.epoch),
  );
}

function recordPlan(state: State, report: CheckReport): void {
  const plan = report.facts?.plan;
  const contentEpoch = state.plan === "pending" ? state.epoch.content : undefined;
  if (
    plan === "persisted" &&
    hasSuccessfulEffect(state, report.evidence, { effect: "memory", contentEpoch })
  ) {
    state.plan = "persisted";
    return;
  }
  if (plan === "prohibited" && hasSuccessfulEffect(state, report.evidence, { effect: "user" })) {
    state.plan = "prohibited";
    return;
  }
  throw new Error(
    "计划必须有当前有效的实际 Memory 成功证据，或用户/更高优先级禁止持久化的准确来源；缺工具不是例外",
  );
}

function recordExecutor(state: State, report: CheckReport): void {
  const executor = report.facts?.executor;
  if (executor !== "root" && executor !== "sub_agent") {
    throw new Error("DE02 必须明确 executor=root/sub_agent 并引用当前执行者选择证据");
  }
  state.execution = { executor };
  state.signals = state.signals.filter((signal) => signal !== "executor_changed");
}

function confirmDispatch(state: State): void {
  if (!state.slice || state.execution?.executor !== "sub_agent" || !state.execution.roleConfirmed) {
    throw new Error("DE05 须有已核验的子代理职责及当前 Slice");
  }
  state.execution.dispatchEpoch = structuredClone(state.epoch);
}

function recordExecution(state: State, report: CheckReport): void {
  switch (report.checkpoint) {
    case "DE02":
      return recordExecutor(state, report);
    case "DE03":
      if (report.outcome === "complete" && state.execution?.executor === "sub_agent") {
        state.execution.roleConfirmed = true;
      }
      return;
    case "DE04":
      if (!state.slice) throw new Error("DE04 须先放行当前 Slice");
      return;
    case "DE05":
      if (report.outcome === "complete") confirmDispatch(state);
  }
}

function hasCurrentVerifierReview(state: State, evidence: string[]): boolean {
  const verifierCalls = state.allocations.filter(
    (allocation) =>
      allocation.role === "Change Verification" &&
      allocation.status === "completed" &&
      evidence.includes(allocation.callId),
  );
  return verifierCalls.some(({ callId }) =>
    state.observations.some(
      (observation) =>
        observation.id === callId &&
        observation.effect === "delegate" &&
        observation.ok &&
        sameEpoch(observation.epoch, state.epoch),
    ),
  );
}

function recordCurrentCheck(state: State, report: CheckReport): void {
  if (report.facts?.verification !== "passed" || !hasCurrentCheck(state, report.evidence)) {
    throw new Error("验证必须引用当前 epoch 的实际检查调用并明确结果；不可用/失败/旧检查不能通过");
  }
  state.checked = structuredClone(state.epoch);
}

function recordVerification(state: State, report: CheckReport): void {
  const { checkpoint, facts, evidence } = report;
  if (checkpoint === "VR03") return recordCurrentCheck(state, report);
  if (checkpoint !== "VR02" || state.independence !== "required") return;

  const currentVerifier = hasCurrentVerifierReview(state, evidence);
  const userReview = hasSuccessfulEffect(state, evidence, { effect: "user" });
  if (facts?.independence !== "satisfied" || !(currentVerifier || userReview)) {
    throw new Error(
      "须有当前独立 verifier 的真实返回或用户提供的独立审阅证据；Primary 返回或同会话改名均无法满足独立性，仍须语义核验来源和覆盖面",
    );
  }
}

function recordDocumentation(state: State, report: CheckReport): void {
  if (report.checkpoint !== "DOC05" || state.independence !== "not_required") return;
  if (
    !state.verified ||
    state.verified.content !== state.epoch.content ||
    state.verified.git !== state.epoch.git
  )
    return;
  if (report.facts?.verification !== "passed" || !hasCurrentCheck(state, report.evidence)) return;

  // 只有文档维度可复用当前检查，内容和 Git 状态变化交由 Verification 核对。
  state.verified.documentation = state.epoch.documentation;
}

function recordArchive(state: State, report: CheckReport): void {
  if (state.plan === "prohibited") return;

  // 对已归档的同一计划可以引用原证据；新归档需核对当前内容。
  const contentEpoch = state.plan === "persisted" ? state.epoch.content : undefined;
  const archiveConfirmed =
    report.outcome === "complete" &&
    report.facts?.plan === "archived" &&
    state.plan !== "pending" &&
    hasSuccessfulEffect(state, report.evidence, { effect: "memory", contentEpoch });
  if (!archiveConfirmed) throw new Error("归档须有真实 Memory 操作与内容保全核验的证据");
  state.plan = "archived";
}

function recordDelivery(state: State, report: CheckReport): void {
  if (report.checkpoint === "DA04") return recordArchive(state, report);
  if (report.checkpoint === "DA03" && report.facts?.acceptance !== "satisfied") {
    throw new Error("验收标准须在摘要中逐项映射当前证据");
  }
}

function recordContract(state: State, report: CheckReport): void {
  if (report.checkpoint !== "ER01") return;
  const independence = report.facts?.independence;
  if (independence !== "required" && independence !== "not_required") {
    throw new Error("Contract 必须明确 independence=required/not_required，不能推断");
  }
  state.independence = independence;
}

// 由引擎在当前检查点和引用已核对后调用，写入结构化证据结论。
export function applyCheckpointEvidence(state: State, report: CheckReport): void {
  switch (state.phase) {
    case "entry":
      return recordContract(state, report);
    case "definition":
      if (report.checkpoint === "WD03") recordPlan(state, report);
      return;
    case "execution":
      return recordExecution(state, report);
    case "verification":
      return recordVerification(state, report);
    case "documentation":
      return recordDocumentation(state, report);
    case "delivery":
      return recordDelivery(state, report);
  }
}
