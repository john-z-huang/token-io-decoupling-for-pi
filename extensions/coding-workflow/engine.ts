import type { Catalog } from "./catalog.ts";
import { addAvailableSlot, executionBlock, releaseSlice, reserveJobs } from "./engine/workflow-execution.ts";
import { recordSignal, resolveUnknownEffect, resumeWorkflow } from "./engine/workflow-recovery.ts";
import {
  hasText,
  pauseWorkflow,
  recordMutation,
  sameContentAndDocumentation,
  requireActive,
  requireEvidence,
  WORKFLOW_HISTORY_LIMIT,
  type Allocation,
  type Dimension,
  type Effect,
  type Epoch,
  type ObservationInput,
  type Role,
  type Slice,
  type State,
  type WorkflowSignal,
} from "./host/session-state.ts";

export { exactPath } from "./engine/workflow-execution.ts";
export { makeState, restoreState } from "./engine/workflow-snapshot.ts";
export { ROLES } from "./host/session-state.ts";
export type {
  Allocation,
  Dimension,
  Effect,
  Epoch,
  Observation,
  Role,
  Slice,
  State,
} from "./host/session-state.ts";

export class Workflow {
  catalog: Catalog;
  state: State;

  constructor(catalog: Catalog, state: State) {
    this.catalog = catalog;
    this.state = structuredClone(state);
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

  release(revision: number, slice: Slice): void {
    this.assertRevision(revision);
    requireActive(this.state);
    if (this.state.inFlight.length) throw new Error("须先读回尚未确认的操作，才能放行新 Slice");
    requireEvidence(this.state, slice.evidence);
    releaseSlice(this.state, slice);
  }

  canRun(effect: Effect, path?: string): string | undefined {
    return executionBlock(this.state, { effect, path });
  }

  pause(reason: string): void {
    pauseWorkflow(this.state, reason);
  }

  resume(revision: number, evidence: string[]): void {
    this.assertRevision(revision);
    requireEvidence(this.state, evidence);
    resumeWorkflow(this.state, evidence);
  }

  resolveEffect(revision: number, callId: string, evidence: string[]): void {
    this.assertRevision(revision);
    requireEvidence(this.state, evidence);
    resolveUnknownEffect(this.state, callId, evidence);
  }

  signal(revision: number, request: WorkflowSignal): void {
    this.assertRevision(revision);
    requireEvidence(this.state, request.evidence);
    recordSignal(this.state, request);
  }

  reserve(jobs: { role: Role; callId: string }[]): Allocation[] {
    requireActive(this.state);
    return reserveJobs(this.state, jobs);
  }

  addSlot(role: string): void {
    addAvailableSlot(this.state, role);
  }

  recordVerification(revision: number, evidence: string[]): void {
    this.assertRevision(revision);
    requireActive(this.state);
    requireEvidence(this.state, evidence);
    const { observations, epoch, inFlight } = this.state;
    if (
      inFlight.length ||
      !evidence.every((id) =>
        observations.some(
          (item) =>
            item.id === id &&
            item.ok &&
            item.effect === "check" &&
            item.revision > (this.state.pauseRevision ?? -1) &&
            sameContentAndDocumentation(item.epoch, epoch),
        ),
      )
    ) {
      throw new Error("须引用与当前内容及文档一致的成功检查，且不存在未决调用");
    }
    this.state.verified = { content: epoch.content, documentation: epoch.documentation };
    this.state.revision++;
  }

  finish(revision: number): void {
    this.assertRevision(revision);
    requireActive(this.state);
    if (this.state.inFlight.length) throw new Error("存在结果不明的操作，先读回再结束");
    this.state.status = "complete";
    this.state.slice = undefined;
    this.state.revision++;
  }
}
