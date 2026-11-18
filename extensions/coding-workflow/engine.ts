import type { Catalog, Checkpoint } from "./catalog.ts";
import { currentCheckpoint, isApplicable, reportCheckpoints } from "./engine/checkpoint-progress.ts";
import { addAvailableSlot, executionBlock, releaseSlice, reserveJobs } from "./engine/workflow-execution.ts";
import { recordSignal, resolveUnknownEffect, resumeWorkflow } from "./engine/workflow-recovery.ts";
import {
  hasText,
  pauseWorkflow,
  recordMutation,
  requireActive,
  requireEvidence,
  WORKFLOW_HISTORY_LIMIT,
  type Allocation,
  type CheckReport,
  type Dimension,
  type Effect,
  type Epoch,
  type ObservationInput,
  type Role,
  type Slice,
  type State,
  type WorkflowSignal,
} from "./workflow-state.ts";

export { exactPath } from "./engine/workflow-execution.ts";
export { makeState, restoreState } from "./engine/workflow-snapshot.ts";
export { ROLES, sameEpoch } from "./workflow-state.ts";
export type {
  Allocation,
  CheckReport,
  Dimension,
  Effect,
  Epoch,
  Observation,
  Role,
  Slice,
  State,
} from "./workflow-state.ts";

// 会话只按当前路线和已观察证据推进，语义结论仍由实际证据核验。
export class Workflow {
  catalog: Catalog;
  state: State;

  constructor(catalog: Catalog, state: State) {
    this.catalog = catalog;
    this.state = structuredClone(state);
  }

  get checkpoint(): Checkpoint | undefined {
    return currentCheckpoint(this.catalog, this.state);
  }

  isApplicable(checkpoint: Checkpoint): boolean {
    return isApplicable(this.state, checkpoint);
  }

  snapshot(): State {
    return structuredClone(this.state);
  }

  assertRevision(revision: number): void {
    if (revision !== this.state.revision) {
      throw new Error(`状态已变更：预期 revision=${this.state.revision}，请按当前上下文重审`);
    }
  }

  observe({ id, tool, effect, ok }: ObservationInput, epoch: Epoch = this.state.epoch): void {
    if (!hasText(id) || this.state.observations.some((observation) => observation.id === id)) return;
    this.state.observations.push({
      id,
      tool,
      effect,
      ok,
      epoch: structuredClone(epoch),
      revision: this.state.revision,
    });
    this.state.observations = this.state.observations.slice(-WORKFLOW_HISTORY_LIMIT);
    this.state.revision++;
  }

  mutate(dimension: Dimension): void {
    recordMutation(this.state, dimension);
  }

  report(revision: number, reports: CheckReport[]): void {
    this.assertRevision(revision);
    requireActive(this.state);
    this.state = reportCheckpoints(this.catalog, this.state, reports);
  }

  release(revision: number, slice: Slice): void {
    this.assertRevision(revision);
    requireActive(this.state);
    requireEvidence(this.state, slice.evidence);
    releaseSlice(this.catalog, this.state, slice);
  }

  canRun(effect: Effect, path?: string): string | undefined {
    return executionBlock(this.catalog, this.state, { effect, path });
  }

  pause(reason: string): void {
    pauseWorkflow(this.state, reason);
  }

  resume(revision: number, evidence: string[]): void {
    this.assertRevision(revision);
    requireEvidence(this.state, evidence);
    resumeWorkflow(this.catalog, this.state, evidence);
  }

  resolveEffect(revision: number, callId: string, evidence: string[]): void {
    this.assertRevision(revision);
    requireEvidence(this.state, evidence);
    resolveUnknownEffect(this.state, callId, evidence);
  }

  signal(revision: number, request: WorkflowSignal): void {
    this.assertRevision(revision);
    requireEvidence(this.state, request.evidence);
    recordSignal(this.catalog, this.state, request);
  }

  reserve(jobs: { role: Role; callId: string }[]): Allocation[] {
    requireActive(this.state);
    return reserveJobs(this.state, this.checkpoint, jobs);
  }

  addSlot(role: string): void {
    addAvailableSlot(this.state, role);
  }

  nudge(): boolean {
    if (this.state.status !== "active") return false;
    if (this.state.autoTurns >= 8 || this.state.lastNudge === this.state.progress) {
      this.pause("自动续跑已达限或无检查点进展；请检查阻塞后显式恢复");
      return false;
    }
    this.state.autoTurns++;
    this.state.lastNudge = this.state.progress;
    return true;
  }
}
