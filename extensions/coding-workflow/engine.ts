import { randomUUID } from "node:crypto";
import { currentModule, SIGNALS, type Catalog, type Checkpoint, type HookId, type Mode, type Phase, type SemanticSignal } from "./catalog.ts";

import { validateAnswers, type Audit } from "./startup.ts";

export type Dimension = "content" | "documentation" | "git";
export type Effect = "read" | "check" | "content" | "documentation" | "git" | "memory";
export const ROLES = ["Primary Output", "Change Verification", "Context Bootstrap/Refresh", "Documentation/Comments & Git Operations"] as const;
export type Role = typeof ROLES[number];
export type Epoch = Record<Dimension, number>;
export interface Observation { id: string; tool: string; effect: Effect | "user" | "delegate"; ok: boolean; epoch: Epoch; revision: number }
export interface Slice { objective: string; paths: string[]; mutations: Effect[]; returnConditions: string; unreleased: string; evidence: string[] }
export interface CheckReport { checkpoint: string; outcome: "complete" | "not_applicable" | "needs_prerequisite" | "blocked"; summary: string; evidence: string[]; facts?: Record<string, string> }
export interface Allocation { id: string; role: Role; callId: string; status: "running" | "completed" | "failed" | "uncertain" }
interface ExecutionDecision {
  executor: "root" | "sub_agent";
  roleConfirmed?: true;
  dispatchEpoch?: Epoch;
}
export interface State {
  version: 1; sessionId: string; cwd: string; catalogHash: string; runId: string; mode: Mode; childCount: number;
  audit?: Audit;
  task: string; phase: Phase; step: number; revision: number; progress: number;
  status: "active" | "paused" | "blocked" | "complete"; reason: string; pauseRevision?: number;
  epoch: Epoch; checked?: Epoch; verified?: Epoch; returnTo?: { phase: Phase; step: number };
  decisionReturn?: { phase: Phase; checkpoint: string };
  execution?: ExecutionDecision;
  reports: { phase: Phase; epoch: Epoch; report: CheckReport; notApplicable?: string[] }[];
  observations: Observation[]; allocations: Allocation[]; inFlight: string[];
  signals: SemanticSignal[]; slice?: Slice; plan: "pending" | "persisted" | "prohibited" | "archived";
  independence: "unknown" | "required" | "not_required"; autoTurns: number; lastNudge: number;
}
const MAX_HISTORY = 128;
const SLICE_START: Partial<Record<HookId, string>> = { execution: "SE02", delegation: "DE04", documentation: "DOC02", delivery: "DA02" };
const copy = <T>(value: T): T => structuredClone(value);
export const sameEpoch = (a: Epoch | undefined, b: Epoch) => !!a && Object.keys(b).every(k => a[k as Dimension] === b[k as Dimension]);
const nonempty = (v: unknown, max = 2000): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
export function exactPath(path: string): boolean { return nonempty(path, 4096) && !/[*?\[\]{}\u0000-\u001f]/.test(path) && !path.startsWith("/") && !path.startsWith("@") && !path.includes("\\") && !path.split("/").some(p => !p || p === "." || p === ".." || p === ".git"); }
export function makeState(catalog: Catalog, sessionId: string, cwd: string, mode: Mode, count: number, task: string): State {
  if (!nonempty(sessionId) || !nonempty(cwd, 4096) || !nonempty(task, 8000)) throw new Error("会话、目录与任务必须明确");
  if (!["single", "multi"].includes(mode) || !Number.isSafeInteger(count) || (mode === "single" ? count !== 0 : count < 1)) throw new Error("模式与子代理数量不一致");
  return { version: 1, sessionId, cwd, catalogHash: catalog.digest, runId: randomUUID(), mode, childCount: count, task,
    phase: catalog.routes[mode].phases[0], step: 0, revision: 0, progress: 0, status: "active", reason: "", epoch: { content: 0, documentation: 0, git: 0 },
    reports: [], observations: [], allocations: [], inFlight: [], signals: [], plan: "pending", independence: "unknown", autoTurns: 0, lastNudge: -1 };
}

/** A coordinator for order and supplied evidence, NOT an authorization or semantic truth oracle. */
export class Workflow {
  catalog: Catalog;
  state: State;
  constructor(catalog: Catalog, state: State) { this.catalog = catalog; this.state = copy(state); }
  private get module() { return currentModule(this.catalog, this.state.phase, this.state.mode); }
  get checkpoint() { return this.module.checkpoints[this.state.step]; }
  isApplicable(checkpoint: Checkpoint): boolean {
    return checkpoint.applicability !== "sub_agent" || this.state.execution?.executor !== "root";
  }
  snapshot(): State { return copy(this.state); }
  assertRevision(revision: number) { if (revision !== this.state.revision) throw new Error(`状态已变更：预期 revision=${this.state.revision}，请按当前上下文重审`); }
  private active() { if (this.state.status !== "active") throw new Error(`当前为 ${this.state.status}：${this.state.reason}`); }
  private refs(refs: string[]) {
    if (!Array.isArray(refs) || refs.length < 1 || refs.length > 16 || refs.some(id => !this.state.observations.some(o => o.id === id))) throw new Error("必须引用当前运行中真实观察到的工具调用或用户输入；引用不是语义真实性证明");
  }
  private hasEffect(refs: string[], effect: Observation["effect"], contentEpoch?: number) {
    return this.state.observations.some(o => refs.includes(o.id) && o.effect === effect && o.ok &&
      (contentEpoch === undefined || o.epoch.content === contentEpoch));
  }
  private hasCurrentCheck(evidence: string[]) {
    return this.state.observations.some(o => evidence.includes(o.id) && o.effect === "check" && o.ok && sameEpoch(o.epoch, this.state.epoch));
  }
  private position(phase: Phase, checkpoint?: string) {
    const step = checkpoint === undefined ? 0 : currentModule(this.catalog, phase, this.state.mode).checkpoints.findIndex(item => item.id === checkpoint);
    if (step < 0) throw new Error(`无法找到检查点 ${checkpoint}`);
    return { phase, step };
  }
  private moveTo(phase: Phase, checkpoint?: string) {
    Object.assign(this.state, this.position(phase, checkpoint));
  }
  private reverify(phase: "documentation" | "delivery", checkpoint: string) {
    this.state.returnTo = this.position(phase, checkpoint);
    this.state.checked = undefined;
    this.revokeSlice();
    this.moveTo("verification");
  }
  private revokeSlice() {
    this.state.slice = undefined;
    if (this.state.execution) delete this.state.execution.dispatchEpoch;
  }
  private resumeDecision(target: NonNullable<State["decisionReturn"]>) {
    this.state.decisionReturn = undefined;
    this.state.signals = this.state.signals.filter(signal => signal !== "decision_required" && signal !== "requirements_changed");
    this.moveTo(target.phase, target.checkpoint);
    this.recheckBeforeGit();
  }
  private currentContentAndDocumentation() {
    const { verified, epoch } = this.state;
    return verified?.content === epoch.content && verified.documentation === epoch.documentation;
  }
  private recheckBeforeGit() {
    if (this.state.phase === "delivery" && this.checkpoint?.id === "DA02" && !this.currentContentAndDocumentation()) {
      this.reverify("delivery", "DA02");
    }
  }
  observe(id: string, tool: string, effect: Observation["effect"], ok: boolean, epoch = this.state.epoch) {
    if (!nonempty(id) || this.state.observations.some(o => o.id === id)) return;
    this.state.observations.push({ id, tool, effect, ok, epoch: copy(epoch), revision: this.state.revision });
    this.state.observations = this.state.observations.slice(-MAX_HISTORY);
    this.state.revision++;
  }
  mutate(dimension: Dimension) {
    this.state.epoch[dimension]++; this.state.revision++;
    if (this.state.status === "complete") { this.state.verified = undefined; this.state.reason = "历史任务已结束；验收后实际状态变化，原证据不再证明当前状态。新工作须显式开始新任务"; }
  }
  report(revision: number, reports: CheckReport[]) {
    this.assertRevision(revision); this.active();
    if (!Array.isArray(reports) || reports.length < 1 || reports.length > 10) throw new Error("一次提交1至10项同模块检查点结果");
    // Validate on a copy: a bad later report must not partially advance the batch.
    const trial = new Workflow(this.catalog, this.state);
    const phase = this.state.phase;
    for (const [index, report] of reports.entries()) {
      if (trial.state.phase !== phase) throw new Error("批次不能跨模块；先消费下一模块 Hooks");
      const step = trial.state.step;
      const recheckingDecision = trial.state.decisionReturn !== undefined;
      trial.reportOne(report);
      if (index === reports.length - 1) continue;
      if (trial.state.status !== "active") throw new Error("暂停或阻断必须是批次末项");
      if (recheckingDecision && !trial.state.decisionReturn) throw new Error("批次不能跨越决策补证的返回位置；先核对原检查点");
      if (trial.state.phase === phase && trial.state.step <= step) throw new Error("批次须止于重核入口；先检查当前状态");
    }
    this.state = trial.state;
  }
  private reportOne(report: CheckReport) {
    const step = this.checkpoint;
    const state = this.state;
    if (!step || report.checkpoint !== step.id) throw new Error(`当前检查点是 ${step?.id}，不能跳步`);
    if (!nonempty(report.summary) || !["complete", "not_applicable", "needs_prerequisite", "blocked"].includes(report.outcome)) throw new Error("结果/有界证据摘要无效");
    this.refs(report.evidence);
    if (report.outcome === "not_applicable" && !step.applicability) throw new Error(`${step.id} 是必需检查点，不能整体 N/A`);
    if (report.outcome === "needs_prerequisite" || report.outcome === "blocked") {
      this.pause(report.summary);
      if (report.outcome === "blocked") state.status = "blocked";
      return;
    }

    const last = state.step === this.module.checkpoints.length - 1;
    const verificationExit = state.phase === "verification" && last;
    const deliveryExit = state.phase === "delivery" && last;
    const beforeGit = step.id === "DA01";
    const beforeAcceptance = step.id === "DA03" || step.id === "DA04" || deliveryExit;
    const deliveryNeedsVerification = beforeGit ? !this.currentContentAndDocumentation()
      : beforeAcceptance && !sameEpoch(state.verified, state.epoch);
    if (verificationExit && !sameEpoch(state.checked, state.epoch)) {
      state.checked = undefined;
      this.moveTo("verification", "VR01");
    } else if (deliveryNeedsVerification) {
      // Git 或计划归档效果已经发生时，只补当前验证和验收证据。
      this.reverify("delivery", beforeGit ? step.id : "DA03");
    } else if (step.id === "DOC04" && state.verified?.content !== state.epoch.content) {
      this.reverify("documentation", step.id);
    } else {
      if ((verificationExit || deliveryExit) && (state.inFlight.length || state.allocations.some(a => a.status === "running" || a.status === "uncertain"))) {
        throw new Error("仍有结果不明的操作，不能完成验证或验收");
      }
      if (deliveryExit && state.plan !== "archived" && state.plan !== "prohibited") {
        throw new Error("交付完成前须有已归档的计划或适用的持久化限制");
      }
      this.record(step, report);
    }
    state.revision++;
    state.progress++;
  }

  private record(step: Checkpoint, report: CheckReport) {
    const state = this.state;
    const facts = report.facts ?? {};
    const { evidence } = report;
    switch (step.id) {
      case "ER01":
        if (facts.independence !== "required" && facts.independence !== "not_required") throw new Error("Contract 必须明确 independence=required/not_required，不能推断");
        state.independence = facts.independence;
        break;
      case "WD03": {
        const contentEpoch = state.plan === "pending" ? state.epoch.content : undefined;
        if (facts.plan === "persisted" && this.hasEffect(evidence, "memory", contentEpoch)) state.plan = "persisted";
        else if (facts.plan === "prohibited" && this.hasEffect(evidence, "user")) state.plan = "prohibited";
        else throw new Error("计划必须有当前有效的实际 Memory 成功证据，或用户/更高优先级禁止持久化的准确来源；缺工具不是例外");
        break;
      }
      case "DE02": {
        const executor = facts.executor;
        if (executor !== "root" && executor !== "sub_agent") throw new Error("DE02 必须明确 executor=root/sub_agent 并引用当前执行者选择证据");
        state.execution = { executor };
        state.signals = state.signals.filter(signal => signal !== "executor_changed");
        break;
      }
      case "DE03":
        if (report.outcome === "complete" && state.execution?.executor === "sub_agent") state.execution.roleConfirmed = true;
        break;
      case "DE04":
        if (!state.slice) throw new Error("DE04 须先放行当前 Slice");
        break;
      case "DE05":
        if (report.outcome === "complete") {
          if (!state.slice || state.execution?.executor !== "sub_agent" || !state.execution.roleConfirmed) throw new Error("DE05 须有已核验的子代理职责及当前 Slice");
          state.execution.dispatchEpoch = copy(state.epoch);
        }
        break;
      case "VR02":
        if (state.independence === "required") {
          const verifier = state.allocations.some(a => a.role === "Change Verification" && a.status === "completed" && evidence.includes(a.callId) &&
            state.observations.some(o => o.id === a.callId && o.effect === "delegate" && o.ok && sameEpoch(o.epoch, state.epoch)));
          if (facts.independence !== "satisfied" || !(verifier || this.hasEffect(evidence, "user"))) throw new Error("须有当前独立 verifier 的真实返回或用户提供的独立审阅证据；Primary 返回或同会话改名均无法满足独立性，仍须语义核验来源和覆盖面");
        }
        break;
      case "VR03":
        if (facts.verification !== "passed" || !this.hasCurrentCheck(evidence)) {
          throw new Error("验证必须引用当前 epoch 的实际检查调用并明确结果；不可用/失败/旧检查不能通过");
        }
        state.checked = copy(state.epoch);
        break;
      case "DOC05":
        if (state.independence === "not_required" && state.verified?.content === state.epoch.content &&
            state.verified.git === state.epoch.git && facts.verification === "passed" && this.hasCurrentCheck(evidence)) {
          state.verified.documentation = state.epoch.documentation;
        }
        break;
      case "DA03":
        if (facts.acceptance !== "satisfied") throw new Error("验收标准须在摘要中逐项映射当前证据");
        break;
      case "DA04": {
        if (state.plan === "prohibited") break;
        const contentEpoch = state.plan === "persisted" ? state.epoch.content : undefined;
        if (report.outcome !== "complete" || facts.plan !== "archived" || state.plan === "pending" || !this.hasEffect(evidence, "memory", contentEpoch)) {
          throw new Error("归档须有真实 Memory 操作与内容保全核验的证据");
        }
        state.plan = "archived";
        break;
      }
    }

    const entry: State["reports"][number] = { phase: state.phase, epoch: copy(state.epoch), report: copy(report) };
    if (step.id === "DE02" && state.execution?.executor === "root") {
      entry.notApplicable = this.module.checkpoints.filter(item => !this.isApplicable(item)).map(item => item.id);
    }
    state.reports.push(entry);
    state.reports = state.reports.slice(-MAX_HISTORY);
    do { state.step++; } while (this.checkpoint && !this.isApplicable(this.checkpoint));

    const target = state.decisionReturn;
    if (state.phase === "definition" && target &&
        ((target.phase === "definition" && this.checkpoint?.id === target.checkpoint) || (step.id === "WD02" && state.plan === "archived"))) {
      this.resumeDecision(target);
    } else if (!this.checkpoint) {
      this.advance();
    }
  }
  private advance() {
    const state = this.state;
    this.revokeSlice();
    state.signals = [];
    const caller = state.decisionReturn;
    if (state.phase === "entry" && caller) {
      if (caller.phase === "session" || (caller.phase === "definition" && ["WD00", "WD01"].includes(caller.checkpoint))) {
        this.resumeDecision(caller);
      } else {
        this.moveTo("definition", "WD01");
      }
      return;
    }
    if (state.phase === "definition" && caller) {
      this.resumeDecision(caller);
      return;
    }
    if (state.phase === "execution") state.execution = undefined;
    if (state.phase === "verification") {
      state.verified = copy(state.checked);
      if (state.returnTo) {
        Object.assign(state, state.returnTo);
        state.returnTo = undefined;
        return;
      }
    }
    if (state.phase === "documentation" && !sameEpoch(state.verified, state.epoch)) {
      this.reverify("documentation", "DOC04");
      return;
    }
    const phases = this.catalog.routes[state.mode].phases;
    const next = phases[phases.indexOf(state.phase) + 1];
    if (!next) {
      state.status = "complete";
      state.reason = "结构化门禁已完成；语义验收仍以报告的真实证据为准";
      return;
    }
    this.moveTo(next);
    if (next === "verification") state.checked = undefined;
  }
  release(revision: number, slice: Slice) {
    this.assertRevision(revision); this.active(); this.refs(slice.evidence);
    const { execution, step, plan } = this.state;
    const { hook, checkpoints } = this.module;
    const floor = checkpoints.findIndex(item => item.id === SLICE_START[hook]);
    const ready = floor >= 0 && step >= floor &&
      (hook !== "delegation" || execution?.executor === "root" || execution?.roleConfirmed === true);
    if (!ready || plan === "pending") throw new Error("尚未到达 Slice 放行条件或共享计划未解决");
    if (![slice.objective, slice.returnConditions, slice.unreleased].every(v => nonempty(v)) || !Array.isArray(slice.paths) || slice.paths.length > 64 || slice.paths.some(p => !exactPath(p))) throw new Error("Slice 四字段必须完整，路径须为精确仓库相对文件，不接受目录/通配/穿越");
    if (!Array.isArray(slice.mutations) || !slice.mutations.length || slice.mutations.some(e => !["read", "check", "content", "documentation", "git", "memory"].includes(e))) throw new Error("Slice 影响类型无效");
    this.revokeSlice(); this.state.slice = copy(slice); this.state.revision++;
  }
  canRun(effect: Effect, path?: string): string | undefined {
    if (["read", "check", "memory"].includes(effect)) return undefined;
    if (this.state.status !== "active") return "路线已暂停/阻断，先取得当前证据并恢复；不要重放效果";
    const slice = this.state.slice;
    if (!slice?.mutations.includes(effect)) return "该影响未被当前 Slice 放行";
    if (effect === "content" && this.state.phase !== "execution") return "内容改动只能在执行/获准修复阶段进行";
    if (effect === "documentation" && !["execution", "documentation"].includes(this.state.phase)) return "当前阶段不接受文档写入";
    if (effect === "git" && (this.state.phase !== "delivery" || this.checkpoint?.id !== SLICE_START.delivery)) {
      return "Git 影响只能在单独获授权的 DA02 检查点执行";
    }
    if (effect === "git" && !this.currentContentAndDocumentation()) {
      return "Git 操作依赖当前内容和文档验证，须先补齐受影响维度";
    }
    if (path !== undefined && !slice.paths.includes(path)) return "路径不在本次 Slice 的精确路径集合中";
    return undefined;
  }
  pause(reason: string) { if (this.state.status !== "complete") this.state.status = "paused"; this.state.reason = reason; this.revokeSlice(); this.state.pauseRevision = this.state.revision; this.state.revision++; }
  resume(revision: number, evidence: string[]) {
    this.assertRevision(revision); this.refs(evidence);
    if (this.state.status === "complete") throw new Error("已完成任务不能通过 resume 隐式新建任务");
    if (this.state.inFlight.length) throw new Error("存在结果不明操作，先使用 resolve_effect 结合当前实际读回证据处置");
    if (!evidence.some(id => this.state.observations.some(o => o.id === id && o.ok && ["read", "check"].includes(o.effect) && o.revision > (this.state.pauseRevision ?? -1)))) throw new Error("恢复前须有暂停后实际读回/检查的证据");
    this.state.status = "active"; this.state.reason = ""; this.revokeSlice();
    this.recheckBeforeGit();
    this.state.revision++;
  }
  resolveEffect(revision: number, id: string, evidence: string[]) {
    this.assertRevision(revision); this.refs(evidence);
    if (!this.state.inFlight.includes(id) || !evidence.some(ref => this.state.observations.some(o => o.id === ref && o.ok && ["read", "check"].includes(o.effect)))) throw new Error("须引用实际读回/检查来处置已知的结果不明操作");
    this.state.inFlight = this.state.inFlight.filter(call => call !== id);
    for (const slot of this.state.allocations) if (slot.callId === id && slot.status === "uncertain") slot.status = "failed";
    this.state.revision++;
  }
  signal(revision: number, signal: SemanticSignal, evidence: string[], reason: string) {
    this.assertRevision(revision); this.refs(evidence);
    if (this.state.status === "complete") throw new Error("终态不能隐式修改任务；由用户明确开始新任务");
    if (!SIGNALS.includes(signal) || !nonempty(reason)) throw new Error("语义信号或说明无效");
    if (signal === "repair_required" && this.state.phase !== "verification") throw new Error("修复信号只能从验证边界进入；Contract 变化先上报 requirements_changed");
    if (signal === "executor_changed" && (this.state.mode !== "multi" || this.state.phase !== "execution" || !this.state.execution || this.state.inFlight.length)) throw new Error("执行者重核须在已有选择的多代理执行模块，且当前效果已读回");
    if (!this.state.signals.includes(signal)) this.state.signals.push(signal);
    if (signal === "requirements_changed") {
      const state = this.state;
      if (state.phase !== "entry") state.decisionReturn ??= { phase: state.phase, checkpoint: this.checkpoint.id };
      this.revokeSlice();
      state.checked = undefined;
      state.verified = undefined;
      state.independence = "unknown";
      // Contract 变化影响验收与计划适用性。已发生的归档仍保留在报告历史。
      state.plan = "pending";
      this.mutate("content");
      this.moveTo("entry");
    } else if (signal === "decision_required") {
      const { phase, decisionReturn } = this.state;
      const checkpoint = this.checkpoint.id;
      if (phase !== "entry" && phase !== "session" && checkpoint !== "WD00") {
        if (!decisionReturn && checkpoint !== "WD01") this.state.decisionReturn = { phase, checkpoint };
        this.moveTo("definition", "WD01");
      }
      this.revokeSlice(); this.state.checked = undefined;
    } else if (signal === "capability_changed") {
      this.revokeSlice();
    } else if (signal === "executor_changed") {
      this.revokeSlice(); this.state.execution = undefined; this.moveTo("execution", "DE02");
    } else if (signal === "repair_required") {
      this.moveTo("execution"); this.revokeSlice(); this.state.execution = undefined;
      // Existing documentation/delivery continuation survives a repair; execution naturally returns to Verification.
    } else if (signal === "documentation_impact") this.mutate("content");
    else if (signal === "git_changed") this.mutate("git");
    this.state.revision++; this.state.progress++;
  }
  reserve(jobs: { role: Role; callId: string }[]): Allocation[] {
    this.active();
    const decision = this.state.execution;
    const execution = this.checkpoint?.id === "DE06" && !!this.state.slice && decision?.executor === "sub_agent" && decision.roleConfirmed && sameEpoch(decision.dispatchEpoch, this.state.epoch);
    const verification = this.checkpoint?.id === "VR02" && jobs.every(j => j.role === "Change Verification");
    if (this.state.mode !== "multi" || !(execution || verification)) throw new Error("创建需要 Multi、具体任务授权及职责门禁；执行须完成 DE05 后在 DE06 一次创建/派发，独立只读验证须到 VR02");
    const roles = [...this.state.allocations.map(a => a.role), ...jobs.map(j => j.role)];
    if (!jobs.length || roles.length > this.state.childCount || roles.some(r => !ROLES.includes(r)) || new Set(roles).size !== roles.length) throw new Error("批准预算不足或职责重复；已创建任务的名额不能回收");
    const allocations = jobs.map(job => ({ id: randomUUID(), ...job, status: "running" as const }));
    this.state.allocations.push(...allocations); this.state.revision++; return copy(allocations);
  }
  addSlot(role: Role) {
    if (this.state.mode !== "multi" || !ROLES.includes(role) || this.state.allocations.some(a => a.role === role) || this.state.allocations.length < this.state.childCount) throw new Error("只能为尚未占用的不同职责，在没有未用名额时明确增加一个名额");
    this.state.childCount++; this.state.revision++;
  }
  nudge(): boolean {
    if (this.state.status !== "active") return false;
    if (this.state.autoTurns >= 8 || this.state.lastNudge === this.state.progress) { this.pause("自动续跑已达限或无检查点进展；请检查阻塞后显式恢复"); return false; }
    this.state.autoTurns++; this.state.lastNudge = this.state.progress; return true;
  }
}

/** Session entries are not a trust boundary. Reject malformed/stale snapshots instead of silently resetting. */
export function restoreState(catalog: Catalog, data: unknown, sessionId: string, cwd: string): State {
  const s = data as State;
  if (!s || s.version !== 1 || s.sessionId !== sessionId || s.cwd !== cwd || s.catalogHash !== catalog.digest) throw new Error("工作流状态版本、Session、目录或规则 Hash 不匹配；须人工重核，不能套用旧状态");
  validateAnswers({ mode: s.mode, count: s.childCount, audit: s.audit });
  const integers = [s.childCount, s.step, s.revision, s.progress, s.autoTurns];
  const phases = catalog.routes[s.mode].phases;
  if (integers.some(n => !Number.isSafeInteger(n) || n < 0) || !phases.includes(s.phase) || !["active", "paused", "blocked", "complete"].includes(s.status) || !nonempty(s.task, 8000)) throw new Error("工作流快照结构无效");
  if ((s.mode === "single" ? s.childCount !== 0 : s.childCount < 1) || !s.epoch || Object.values(s.epoch).length !== 3 || !["content", "documentation", "git"].every(k => Number.isSafeInteger(s.epoch[k as Dimension]) && s.epoch[k as Dimension] >= 0)) throw new Error("数量或 epoch 无效");
  for (const k of ["reports", "observations", "allocations", "inFlight", "signals"] as const) if (!Array.isArray(s[k]) || s[k].length > 256) throw new Error(`状态字段 ${k} 无效`);
  if (s.allocations.length > s.childCount || new Set(s.allocations.map(a => a.role)).size !== s.allocations.length || s.allocations.some(a => !ROLES.includes(a.role) || !["running", "completed", "failed", "uncertain"].includes(a.status))) throw new Error("allocation 无效");
  const length = currentModule(catalog, s.phase, s.mode).checkpoints.length;
  if (s.status === "complete" ? s.phase !== phases.at(-1) || s.step !== length : s.step >= length) throw new Error("检查点位置越界或终态不一致");
  if (!s.signals.every(signal => SIGNALS.includes(signal)) || !["pending", "persisted", "prohibited", "archived"].includes(s.plan) || !["unknown", "required", "not_required"].includes(s.independence)) throw new Error("状态枚举无效");
  if (s.execution && (s.mode !== "multi" || !["root", "sub_agent"].includes(s.execution.executor) || (s.execution.roleConfirmed !== undefined && (s.execution.executor !== "sub_agent" || s.execution.roleConfirmed !== true)))) throw new Error("执行者选择记录无效");
  const target = s.decisionReturn;
  if (target && (target.phase === "entry" || !phases.includes(target.phase) ||
      !currentModule(catalog, target.phase, s.mode).checkpoints.some(item => item.id === target.checkpoint))) throw new Error("决策补证返回位置无效");
  const continuation = s.returnTo;
  if (continuation && ((continuation.phase !== "documentation" && continuation.phase !== "delivery") ||
      !Number.isSafeInteger(continuation.step) || continuation.step < 0 ||
      continuation.step >= currentModule(catalog, continuation.phase, s.mode).checkpoints.length)) throw new Error("验证返回位置无效");
  return copy(s);
}
