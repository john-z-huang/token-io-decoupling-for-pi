import type { Mode, Phase, SemanticSignal } from "./catalog.ts";
import type { Audit } from "./startup.ts";

export const EPOCH_DIMENSIONS = ["content", "documentation", "git"] as const;
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

export interface State {
  version: 1;
  sessionId: string;
  cwd: string;
  catalogHash: string;
  runId: string;
  mode: Mode;
  childCount: number;
  audit?: Audit;

  task: string;
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
