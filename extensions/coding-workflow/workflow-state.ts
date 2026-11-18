import type { Mode, Phase, SemanticSignal } from "./catalog.ts";
import type { Audit } from "./startup.ts";

export const EPOCH_DIMENSIONS = ["content", "documentation", "git"] as const;
export const WORKFLOW_HISTORY_LIMIT = 128;
export type Dimension = (typeof EPOCH_DIMENSIONS)[number];
export type Epoch = Record<Dimension, number>;
export type Effect = "read" | "check" | Dimension | "memory";

export const ROLES = [
  "Primary Output",
  "Change Verification",
  "Context Bootstrap/Refresh",
  "Documentation/Comments & Git Operations",
] as const;
export type Role = (typeof ROLES)[number];

export interface Observation {
  id: string;
  tool: string;
  effect: Effect | "user" | "delegate";
  ok: boolean;
  epoch: Epoch;
  revision: number;
}

export type ObservationInput = Pick<Observation, "id" | "tool" | "effect" | "ok">;

export interface WorkflowSession {
  sessionId: string;
  cwd: string;
}

export interface WorkflowTask {
  mode: Mode;
  childCount: number;
  task: string;
}

export interface WorkflowSignal {
  signal: SemanticSignal;
  evidence: string[];
  reason: string;
}

export interface Slice {
  objective: string;
  paths: string[];
  mutations: Effect[];
  returnConditions: string;
  unreleased: string;
  evidence: string[];
}

export interface CheckReport {
  checkpoint: string;
  outcome: "complete" | "not_applicable" | "needs_prerequisite" | "blocked";
  summary: string;
  evidence: string[];
  facts?: Record<string, string>;
}

export interface Allocation {
  id: string;
  role: Role;
  callId: string;
  status: "running" | "completed" | "failed" | "uncertain";
}

interface ExecutionDecision {
  executor: "root" | "sub_agent";
  roleConfirmed?: true;
  dispatchEpoch?: Epoch;
}

interface RecordedReport {
  phase: Phase;
  epoch: Epoch;
  report: CheckReport;
  notApplicable?: string[];
}

export interface State extends WorkflowSession, WorkflowTask {
  version: 1;
  catalogHash: string;
  runId: string;
  audit?: Audit;

  phase: Phase;
  step: number;
  revision: number;
  progress: number;
  status: "active" | "paused" | "blocked" | "complete";
  reason: string;
  pauseRevision?: number;
  returnTo?: { phase: Phase; step: number };
  decisionReturn?: { phase: Phase; checkpoint: string };

  epoch: Epoch;
  checked?: Epoch;
  verified?: Epoch;
  independence: "unknown" | "required" | "not_required";
  plan: "pending" | "persisted" | "prohibited" | "archived";
  slice?: Slice;
  execution?: ExecutionDecision;

  reports: RecordedReport[];
  observations: Observation[];
  allocations: Allocation[];
  inFlight: string[];
  signals: SemanticSignal[];
  autoTurns: number;
  lastNudge: number;
}

export function sameEpoch(previous: Epoch | undefined, current: Epoch): boolean {
  return (
    previous !== undefined &&
    EPOCH_DIMENSIONS.every((dimension) => previous[dimension] === current[dimension])
  );
}

export function hasText(value: unknown, limit = 2000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= limit;
}

export function requireActive(state: State): void {
  if (state.status !== "active") throw new Error(`当前为 ${state.status}：${state.reason}`);
}

export function requireEvidence(state: State, evidence: string[]): void {
  if (
    !Array.isArray(evidence) ||
    evidence.length < 1 ||
    evidence.length > 16 ||
    evidence.some((id) => !state.observations.some((observation) => observation.id === id))
  ) {
    throw new Error("必须引用当前运行中真实观察到的工具调用或用户输入；引用不是语义真实性证明");
  }
}

export function revokeSlice(state: State): void {
  state.slice = undefined;
  if (state.execution) delete state.execution.dispatchEpoch;
}

export function pauseWorkflow(state: State, reason: string): void {
  if (state.status !== "complete") state.status = "paused";
  state.reason = reason;
  revokeSlice(state);
  state.pauseRevision = state.revision;
  state.revision++;
}

export function recordMutation(state: State, dimension: Dimension): void {
  state.epoch[dimension]++;
  state.revision++;
  if (state.status === "complete") {
    state.verified = undefined;
    state.reason = "历史任务已结束；验收后实际状态变化，原证据不再证明当前状态。新工作须显式开始新任务";
  }
}

export function hasCurrentContentAndDocumentation(state: State): boolean {
  const { verified, epoch } = state;
  return verified?.content === epoch.content && verified.documentation === epoch.documentation;
}
