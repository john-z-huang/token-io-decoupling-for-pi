import { randomUUID } from "node:crypto";
import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import type { ExtensionAPI, ExtensionContext, ExtensionToolContext, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";
import { currentModule, loadCatalog, phaseHooks, signalHooks, resolveDocumentLink, rewriteDocumentLinks, type Catalog, type HookId, type Mode } from "./catalog.ts";
import { exactPath, makeState, restoreState, ROLES, Workflow, type Effect, type Role, type State } from "./engine.ts";

import { collectStartup, parseStartupCommand, registerStartupFlags, startupFlags, validateAnswers, type StartupAnswers, type StartupInput } from "./startup.ts";
import { compatibleSubagent, resolveSubagentAdapter, subagentInput, subagentModelInput } from "./subagent-adapter.ts";
export { compatibleSubagent } from "./subagent-adapter.ts";

const STATE_TYPE = "token-io.coding-workflow.v1";
const CONTEXT_TYPE = "token-io.coding-hooks.v1";
const INTERNAL = new Set(["coding_checkpoint", "coding_slice", "coding_run", "coding_delegate"]);
const READ_TOOLS = new Set(["read", "grep", "find", "ls", "tool_search"]);
export const MAX_CONTEXT = 96000;
const MAX_RESULT = 64000;
export interface Schemas { checkpoint: TSchema; slice: TSchema; run: TSchema; delegate: TSchema }
interface Intent { effect: Effect; delegate?: boolean }
function text(content: unknown, isError = false) { return { content: [{ type: "text" as const, text: typeof content === "string" ? content : JSON.stringify(content, null, 2) }], details: {}, isError }; }

/** Resolve existing ancestors too: lexical containment alone does not stop a symlink escape. */
export function scopedPath(cwd: string, path: unknown): string {
  if (typeof path !== "string" || !path) throw new Error("缺少文件路径");
  const base = realpathSync(cwd);
  const absolute = resolve(base, path);
  const rel = relative(base, absolute).split(sep).join("/");
  if (!exactPath(rel)) throw new Error("路径须在当前项目内，且不能指向 .git 或目录");
  let ancestor = absolute;
  while (!existsSync(ancestor)) { const parent = dirname(ancestor); if (parent === ancestor) throw new Error("没有可核验的路径祖先"); ancestor = parent; }
  const real = realpathSync(ancestor);
  if (real !== base && (!real.startsWith(base + sep))) throw new Error("路径穿过项目外符号链接");
  if (existsSync(absolute) && statSync(absolute).isDirectory()) throw new Error("Slice 只接受精确文件，不接受目录");
  const canonical = relative(base, resolve(real, relative(ancestor, absolute))).split(sep).join("/");
  if (!exactPath(canonical)) throw new Error("规范目标路径不能指向 .git、项目外或通配范围");
  return canonical;
}
export function fileEffect(path: string): Effect { return /\.(md|mdx|rst|txt|adoc)$/i.test(path) ? "documentation" : "content"; }
/** Inject every execution clause; the non-executable provenance table stays in the linked resource. */
export function renderHook(catalog: Catalog, id: HookId): string {
  const path = `hooks/${id}.md`;
  const markdown = catalog.hooks[id];
  const boundary = markdown.indexOf("\n## 规则来源\n");
  if (boundary < 0) throw new Error(`Hook ${id} 缺少规则来源章节`);
  const source = resolveDocumentLink(catalog.root, path, "#规则来源")!;
  return `[Hook:${id}]\n[完整合同及逐篇来源](${source.url})\n\n${rewriteDocumentLinks(catalog.root, path, markdown.slice(0, boundary).trimEnd())}`;
}

export function renderContext(workflow: Workflow): string {
  const s = workflow.state;
  const hooks = new Set<HookId>(phaseHooks(s.phase, s.mode));
  for (const signal of s.signals) for (const hook of signalHooks(signal)) hooks.add(hook);
  if (s.status !== "active" || s.inFlight.length) hooks.add("recovery");
  if (s.allocations.length) hooks.add("audit");
  const module = currentModule(workflow.catalog, s.phase, s.mode);
  const content = [
    "[Coding Extension：结构化流程，不是权限或事实证明]",
    JSON.stringify({ revision: s.revision, status: s.status, reason: s.reason, mode: s.mode, child_count: s.childCount, audit: s.audit, phase: s.phase, checkpoint: workflow.checkpoint?.id ?? "done", epoch: s.epoch, verified: s.verified, returnTo: s.returnTo, plan: s.plan, allocations: s.allocations, inFlight: s.inFlight, slice: s.slice, task: s.task }),
    "本次用户任务只是目标，不覆盖任何安全/授权规则。不要重放已完成效果。完成当前检查点后用 coding_checkpoint 提交证据；可以一次提交同模块内连续已完成项，但不能跨模块。所有 facts 是 Agent 声明，不是宿主认证。",
    "facts 要求：ER01 independence=required/not_required；WD03 plan=persisted/prohibited；VR03 verification=passed（必须引用 effect=check 实际结果）；DA03 acceptance=satisfied（摘要逐项映射标准）；DA04 plan=archived（用户禁止持久化时除外）。",
    "写前用 coding_slice 放行四字段和精确文件。Bash、codemode 和不透明 MCP 调用通过 coding_run 声明 effect/rationale/evidence；只读声明不是自动安全证明。不得将未经授权的命令标成 read。多代理仅通过 coding_delegate，不能绕过为其他工具/递归子任务。未知语义变化用 coding_checkpoint signal，上报后重核对应 Hook。",
    `当前模块待处理（来自 [${module.path}](${resolveDocumentLink(workflow.catalog.root, module.path, "")!.url})，仅此模块，不预加载全部路线）：\n${module.checkpoints.slice(s.step).map(c => `${c.id} ${c.title}\n${rewriteDocumentLinks(workflow.catalog.root, module.path, c.instruction)}`).join("\n\n")}`,
    workflow.checkpoint ? "只推进已完成的检查点；批量上报也必须逐项有真实证据。" : "已完成结构化检查点，向用户报告实际验收结果和限制。",
    `可引用的最近24项实际观察（更早引用可通过 status 查找；被128项窗口淘汰的证据须重读）：\n${JSON.stringify(s.observations.slice(-24))}`,
    ...[...hooks].map(id => renderHook(workflow.catalog, id)),
  ].join("\n\n");
  if (content.length > MAX_CONTEXT) throw new Error(`当前规则包超出${MAX_CONTEXT}字符上限；停止依赖工作，请缩小任务/规则，而不是截断守卫`);
  return content;
}

/** Separated from TypeBox construction so event integration can be tested without installing Pi. */
export function installWorkflow(pi: ExtensionAPI, schemas: Schemas, suppliedCatalog?: Catalog) {
  let workflow: Workflow | undefined;
  let enabled = false;
  let restoreError = "";
  let answers: StartupAnswers | undefined;
  let answerSession = "";
  let generation = 0;
  let starting = false;
  let startupError = "";
  let catalog: Catalog | undefined = suppliedCatalog;
  let ledger: { mode: Mode; count: number; allocations: State["allocations"]; inFlight: string[] } | undefined;
  const intents = new Map<string, Intent>();
  const allowedDelegates = new Set<string>();
  const observedEffects = new Set<string>();
  let releasedReservations = new Set<string>();
  const pendingResults = new Map<string, string>();
  const getCatalog = () => catalog ??= loadCatalog();
  const volatile = () => pi.getFlag("coding-volatile") === true;
  const active = () => enabled && !!workflow;
  function requireWorkflow() { if (!active() || restoreError) throw new Error(restoreError || "先由用户通过 /coding start 或 single|multi [数量] <任务> 完成启动收集"); return workflow!; }
  function persist(ctx: ExtensionContext) {
    if (!volatile()) pi.appendEntry(STATE_TYPE, { enabled, state: workflow?.snapshot(), answers, error: restoreError, releasedReservations: [...releasedReservations] });
    if (ctx.hasUI) ctx.ui.setStatus("coding-workflow", active() ? `Coding ${workflow!.state.mode} · ${workflow!.state.phase}/${workflow!.checkpoint?.id ?? "done"} · ${workflow!.state.status}` : restoreError ? "Coding: 状态需人工恢复" : undefined);
  }
  function reply(ctx: ExtensionContext, message: string) { if (ctx.hasUI) ctx.ui.notify(message, "info"); else pi.sendMessage({ customType: CONTEXT_TYPE + ".notice", content: message, display: true }); }
  function output(offset?: number) {
    const s = workflow!.state;
    offset ??= Math.max(0, s.observations.length - 24);
    return { runId: s.runId, revision: s.revision, status: s.status, reason: s.reason, mode: s.mode, childCount: s.childCount, audit: s.audit,
      phase: s.phase, step: s.step, next: workflow!.checkpoint?.id ?? "done", epoch: s.epoch, verified: s.verified, returnTo: s.returnTo,
      plan: s.plan, allocations: s.allocations, inFlight: s.inFlight, slice: s.slice,
      observationCount: s.observations.length, observationsOffset: offset, nextObservationsOffset: offset + 24 < s.observations.length ? offset + 24 : null,
      observations: s.observations.slice(offset, offset + 24), recentReports: s.reports.slice(-2).map(r => ({ checkpoint: r.report.checkpoint, epoch: r.epoch })),
      hooks: phaseHooks(s.phase, s.mode) };
  }
  function scanLedger(ctx: ExtensionContext) {
    const envelopes = ctx.sessionManager.getEntries().filter(e => e.type === "custom" && e.customType === STATE_TYPE)
      .map(e => (e as { data?: { state?: State; releasedReservations?: string[] } }).data)
      .filter(e => e?.state?.sessionId === ctx.sessionManager.getSessionId() && e.state.cwd === realpathSync(ctx.cwd));
    const snapshots = envelopes.map(e => e!.state!);
    if (!snapshots.length) return undefined;
    releasedReservations = new Set(envelopes.flatMap(e => e!.releasedReservations ?? []));
    const slots = new Map<string, State["allocations"][number]>();
    const runs = new Map<string, State>();
    for (const state of snapshots) {
      restoreState(getCatalog(), state, ctx.sessionManager.getSessionId(), realpathSync(ctx.cwd));
      if (!Array.isArray(state.allocations) || !Array.isArray(state.inFlight) || !Number.isSafeInteger(state.childCount)) throw new Error("会话级预算历史损坏，不能重置");
      for (const slot of state.allocations) if (!releasedReservations.has(slot.id)) slots.set(slot.id, structuredClone(slot));
      runs.set(state.runId, state);
    }
    const last = snapshots.at(-1)!;
    return { mode: last.mode, count: Math.max(...snapshots.map(s => s.childCount)), allocations: [...slots.values()], inFlight: [...new Set([...runs.values()].flatMap(s => s.inFlight))] };
  }
  function start(ctx: ExtensionContext, mode: Mode, count: number, task: string) {
    if (restoreError) throw new Error(restoreError);
    if (volatile() && !workflow && ctx.sessionManager.getEntries().some(e => e.type === "custom_message" && e.customType === CONTEXT_TYPE + ".start" && (e.details as { sessionId?: string } | undefined)?.sessionId === ctx.sessionManager.getSessionId())) throw new Error("volatile 历史存在但当前进程状态不可恢复；请使用新 Session，不能假设预算清空");
    ledger = volatile() ? ledger : scanLedger(ctx) ?? ledger;
    if (ledger && (ledger.mode !== mode || ledger.count !== count || ledger.inFlight.length)) throw new Error("整个 Session 的模式/预算仍锁定或有未知效果；树导航不是重置授权，请恢复原任务或新建 Session");
    if (workflow && workflow.state.sessionId === ctx.sessionManager.getSessionId()) {
      if (workflow.state.status !== "complete") throw new Error("已有任务；使用 status / pause / resume，不能重建状态绕过预算或重复效果");
      if (workflow.state.mode !== mode || workflow.state.childCount !== count) throw new Error("同 Session 已锁定 Mode/count；新路线请使用新 Session，扩容须显式 add-slot");
    }
    const previous = workflow;
    workflow = new Workflow(getCatalog(), makeState(getCatalog(), ctx.sessionManager.getSessionId(), realpathSync(ctx.cwd), mode, count, task));
    if (previous || ledger) workflow.state.allocations = structuredClone(previous?.state.allocations ?? ledger!.allocations);
    workflow.state.audit = structuredClone(answers!.audit);
    enabled = true;
    workflow.observe(`command:${randomUUID()}`, "/coding", "user", true);
    intents.clear(); allowedDelegates.clear(); observedEffects.clear(); pendingResults.clear(); persist(ctx);
  }
  async function requestStart(ctx: ExtensionContext, input: StartupInput, task: string) {
    if (starting) throw new Error("已有启动提问进行中；不能并发或重复启动");
    if (restoreError) throw new Error(restoreError);
    if (workflow && workflow.state.status !== "complete") throw new Error("已有任务；不能重建状态");
    const token = ++generation;
    const session = ctx.sessionManager.getSessionId();
    starting = true; startupError = "启动答案未完成；禁止执行工具";
    try {
      const current = () => { if (token !== generation || ctx.sessionManager.getSessionId() !== session) throw new Error("启动已取消：Session/树导航发生变化"); };
      const collected = await collectStartup(ctx, input, answers, current);
      current();
      const previous = answers;
      answers = collected;
      try { start(ctx, collected.mode, collected.count, task); }
      catch (error) { answers = previous; throw error; }
      answerSession = session; startupError = "";
    } catch (error) { if (token === generation) startupError = String(error); throw error; }
    finally { if (token === generation) starting = false; }
  }
  function nearestIntent(id?: string): Intent | undefined {
    while (id) { const intent = intents.get(id); if (intent) return intent; const next = id.lastIndexOf("/"); if (next < 0) break; id = id.slice(0, next); }
    return undefined;
  }
  function isDelegate(name: string) { return pi.getAllTools().some(t => t.name === name && (compatibleSubagent(t.parameters) || name === "subagent")); }
  function readOnly(name: string) { return READ_TOOLS.has(name); }
  function targetAvailable(ctx: ExtensionToolContext, name: string) { return ctx.tools.some(t => t.name === name); }
  function guard(event: ToolCallEvent, ctx: ExtensionContext): string | undefined {
    if (starting || startupError) return startupError || "启动进行中；禁止执行工具";
    if (!enabled) return undefined;
    if (restoreError) return INTERNAL.has(event.toolName) || readOnly(event.toolName) ? undefined : restoreError;
    const w = workflow!;
    if (INTERNAL.has(event.toolName)) return undefined;
    if (isDelegate(event.toolName)) {
      if (!event.parentToolCallId || !allowedDelegates.has(event.parentToolCallId)) return "子任务必须经 coding_delegate 预算、角色、任务和实际 Schema 门禁；不允许直接或脚本旁路";
      return undefined;
    }
    if (["edit", "write"].includes(event.toolName)) {
      try {
        const path = scopedPath(ctx.cwd, (event.input as Record<string, unknown>).path);
        const effect = fileEffect(path);
        const block = w.canRun(effect, path);
        if (!block) {
          intents.set(event.toolCallId, { effect });
          w.state.inFlight.push(event.toolCallId); persist(ctx);
        }
        return block;
      } catch (error) { return String(error); }
    }
    if (readOnly(event.toolName)) { intents.set(event.toolCallId, { effect: "read" }); return undefined; }
    const intent = nearestIntent(event.parentToolCallId);
    if (!intent || intent.delegate) return "不透明工具须通过 coding_run 声明影响、依据和当前 Slice；不根据 Shell 名称猜测安全性";
    const block = w.canRun(intent.effect);
    if (!block) intents.set(event.toolCallId, intent);
    return block;
  }

  registerStartupFlags(pi);
  pi.registerFlag("coding-volatile", { description: "不额外 appendEntry；状态仅存当前进程，Pi 自身日志需另用 --no-session 管理", type: "boolean", default: false });
  pi.registerCommand("coding", {
    description: "Coding start <任务> | single <任务> | multi [数量] <任务> | status | pause | resume | off | add-slot <完整职责名>",
    handler: async (args, ctx) => {
      try {
        const input = args.trim();
        let request;
        try { request = parseStartupCommand(input); }
        catch (error) { if (!workflow && !starting) startupError = String(error); throw error; }
        if (request) {
          await requestStart(ctx, request.input, request.task);
          pi.sendMessage({ customType: CONTEXT_TYPE + ".start", details: { sessionId: ctx.sessionManager.getSessionId() }, content: "用户已通过 /coding 明确选择路线与目标。按当前 Coding Hooks 开始，先核验 Contract/能力；模式选择不授权写入、Memory 或子任务。", display: true }, { triggerTurn: true }); return;
        }
        if (input === "status" || !input) { reply(ctx, workflow ? JSON.stringify(output(), null, 2) : restoreError || startupError || "未启用。/coding start <任务> 或 single|multi [数量] <任务>"); return; }
        if (input === "cancel" && starting) { generation++; starting = false; startupError = "启动已取消；没有创建 Workflow"; return; }
        if (!workflow || restoreError) throw new Error(restoreError || "没有可恢复的任务");
        if (input === "pause" || input === "off") {
          workflow.pause(input === "off" ? "用户停用扩展；恢复前须读取实际状态" : "用户暂停");
          if (input === "off") { enabled = false; workflow.state.verified = undefined; }
          persist(ctx); return;
        }
        if (input === "resume") {
          enabled = true; workflow.state.autoTurns = 0; workflow.state.lastNudge = -1;
          workflow.observe(`command:${randomUUID()}`, "/coding resume", "user", true);
          // Remain paused until the agent supplies readback evidence through the control tool.
          persist(ctx);
          pi.sendMessage({ customType: CONTEXT_TYPE + ".resume", content: "用户要求恢复。先读回原暂停点、已完成效果及当前状态；用 coding_checkpoint resume/resolve_effect，勿重放命令。", display: true }, { triggerTurn: true }); return;
        }
        if (input.startsWith("add-slot ")) { workflow.addSlot(input.slice(9) as Role); if (answers) answers.count = workflow.state.childCount; workflow.observe(`command:${randomUUID()}`, "/coding add-slot", "user", true); persist(ctx); return; }
        throw new Error("未知命令；/coding status 查看状态。支持 start、single、multi、cancel、pause、resume、off、add-slot。");
      } catch (error) { reply(ctx, String(error)); }
    },
  });
  pi.registerTool({
    name: "coding_checkpoint", label: "Coding 检查点", description: "记录当前同模块检查点、语义信号、暂停/原位恢复和未知效果读回；不授予权限", parameters: schemas.checkpoint, executionMode: "sequential", exposure: "model-only",
    async execute(_id, p: any, _signal, _update, ctx) {
      try {
        const w = requireWorkflow();
        if (p.action === "status") return text(output(p.offset));
        if (p.action === "result") {
          const result = pendingResults.get(p.resultId); if (result === undefined) throw new Error("结果已不可用；不要重跑任务，按实际调用记录核验");
          const offset = p.offset ?? 0; if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("offset 无效");
          return text({ resultId: p.resultId, offset, total: result.length, content: result.slice(offset, offset + 24000), nextOffset: offset + 24000 < result.length ? offset + 24000 : null });
        }
        if (p.action === "report") w.report(p.revision, p.reports);
        else if (p.action === "signal") w.signal(p.revision, p.signal, p.evidence, p.reason);
        else if (p.action === "pause") { w.assertRevision(p.revision); w.pause(p.reason); }
        else if (p.action === "resume") w.resume(p.revision, p.evidence);
        else if (p.action === "resolve_effect") w.resolveEffect(p.revision, p.callId, p.evidence);
        else throw new Error("未知控制动作");
        persist(ctx); return text(output());
      } catch (error) { return text(String(error), true); }
    },
  });
  pi.registerTool({
    name: "coding_slice", label: "Coding Slice", description: "放行有界 Slice：Objective、精确路径/影响、Return conditions、Unreleased boundary，须有当前授权与计划依据", parameters: schemas.slice, executionMode: "sequential", exposure: "model-only",
    async execute(_id, p: any, _signal, _update, ctx) {
      try { const w = requireWorkflow(); for (const path of p.slice.paths) if (scopedPath(ctx.cwd, path) !== path) throw new Error("路径须使用规范项目相对路径"); w.release(p.revision, p.slice); persist(ctx); return text(output()); }
      catch (error) { return text(String(error), true); }
    },
  });
  pi.registerTool({
    name: "coding_run", label: "Coding 显式影响调用", description: "经宿主实际工具链运行已授权的不透明工具；effect 是声明，不是命令安全证明。只调用真实可调用工具，不绕过 hidden/审批。", parameters: schemas.run, executionMode: "sequential", exposure: "model-only", reachesTools: input => typeof input.tool === "string" ? [input.tool] : [],
    async execute(id, p: any, signal, onUpdate, ctx) {
      const w = requireWorkflow();
      try {
        w.assertRevision(p.revision);
        if (INTERNAL.has(p.tool) || isDelegate(p.tool) || !targetAvailable(ctx, p.tool)) throw new Error("工具不存在/hidden/递归/子代理旁路；先发现真实工具与 Schema");
        if (!p.rationale?.trim() || !Array.isArray(p.evidence) || !p.evidence.length || p.evidence.some((ref: string) => !w.state.observations.some(o => o.id === ref))) throw new Error("缺少效果分类依据和真实授权/上下文证据引用");
        const block = w.canRun(p.effect); if (block) throw new Error(block);
        const intent = { effect: p.effect as Effect }; intents.set(id, intent);
        w.state.inFlight.push(id); persist(ctx);
        const epochAtCall = structuredClone(w.state.epoch);
        const outcome = await ctx.executeTool(p.tool, p.input, { signal, onUpdate });
        if (!signal?.aborted) w.state.inFlight = w.state.inFlight.filter(ref => ref !== id);
        else w.pause("调用被中止：须先读回实际效果，不自动重试");
        w.observe(id, p.tool, p.effect, !outcome.isError && !signal?.aborted, epochAtCall);
        if (["content", "documentation", "git"].includes(p.effect) && !observedEffects.has(id)) w.mutate(p.effect);
        // Keep all actual body content available; never call an external task again for pagination.
        const body = JSON.stringify(outcome.result); pendingResults.set(id, body);
        persist(ctx);
        return text({ callId: id, isError: outcome.isError, total: body.length, result: body.length <= MAX_RESULT ? outcome.result : body.slice(0, 24000), nextOffset: body.length > MAX_RESULT ? 24000 : null, note: body.length > MAX_RESULT ? "用 coding_checkpoint result 分页读完；不可仅凭摘要接受结果" : undefined }, outcome.isError);
      } catch (error) { if (w.state.inFlight.includes(id)) w.pause("不透明调用中断：效果未知，须读回，禁止自动重放"); persist(ctx); return text(String(error), true); }
      finally { intents.delete(id); }
    },
  });
  pi.registerTool({
    name: "coding_delegate", label: "Coding 有界委派", description: "经实际 Schema 适配 agent/task/cwd 或 calls[] 一次性子任务；串行预留职责预算后并行独立任务，不传 session、不假装持久复用。", parameters: schemas.delegate, executionMode: "sequential", exposure: "model-only", reachesTools: input => typeof input.tool === "string" ? [input.tool] : [],
    async execute(id, p: any, signal, _update, ctx) {
      let w: Workflow;
      try {
        w = requireWorkflow(); w.assertRevision(p.revision);
        const tool = ctx.tools.find(t => t.name === p.tool);
        const adapter = tool && resolveSubagentAdapter(tool.parameters);
        if (!adapter || !isDelegate(p.tool)) throw new Error("未找到可调用的 subagent Schema（agent/task/cwd 或 calls[].agent/prompt/cwd/initialContext）。缺少兼容能力只阻断委派，不伪造子会话");
        if (!p.evidence?.length || p.evidence.some((ref: string) => !w.state.observations.some(o => o.id === ref))) throw new Error("委派缺少真实授权/任务依据引用");
        if (w.state.phase === "verification" && p.jobs.some((job: any) => job.role !== "Change Verification" || job.paths.length)) throw new Error("验证边界仅允许独立只读验证任务");
        if (p.jobs.some((job: any) => job.role === "Documentation/Comments & Git Operations")) throw new Error("当前适配器不支持 Git 子任务；非简单 Git 仍须实际合格的独立扩展与单独授权，不可由本接口冒充");
        const paths = new Set<string>();
        const modelInputs: Record<string, string>[] = [];
        for (const job of p.jobs) {
          if (!ROLES.includes(job.role) || !job.agent?.trim() || !job.task?.trim()) throw new Error("职责、扩展 agent 配置名和真实任务必须明确");
          if (job.model !== undefined && !job.modelReason?.trim()) throw new Error("显式模型选择须有 Root 任务依据；不静默忽略设置");
          if (job.model === undefined && job.modelReason !== undefined) throw new Error("模型选择依据必须对应实际 model 请求");
          modelInputs.push(subagentModelInput(adapter, job.model));
          if (job.paths.length && !["Primary Output", "Documentation/Comments & Git Operations"].includes(job.role)) throw new Error("只读职责不能取得写入路径");
          for (const path of job.paths) {
            if (scopedPath(ctx.cwd, path) !== path || !w.state.slice?.paths.includes(path) || paths.has(path)) throw new Error("子任务写入必须在 Slice 内且并行任务路径不冲突");
            if (fileEffect(path) === "documentation" && !path.startsWith("docs/skill/") && !path.endsWith("/SKILL.md")) throw new Error("普通文档由 Root 处理；Primary 仅可承接 Skill 文档");
            paths.add(path);
          }
        }
        const allocations = w.reserve(p.jobs.map((job: any) => ({ role: job.role, callId: id })));
        w.state.inFlight.push(id); allowedDelegates.add(id); intents.set(id, { effect: "read", delegate: true }); persist(ctx);
        const epochAtDispatch = structuredClone(w.state.epoch);
        const results = await Promise.allSettled(p.jobs.map(async (job: any, i: number) => {
          const scope = job.paths.length ? `仅获准写入这些精确路径：${job.paths.join(", ")}。` : "此任务只读，不准写项目文件。";
          const task = `会话审计偏好及每字段来源：${JSON.stringify(w.state.audit)}。仅安全摘要策略，不代表完整日志访问或私有思维链披露；不改变权限或独立验证。\n父级逻辑 allocation=${allocations[i].id}；职责=${job.role}；这是一次性真实任务，不是可恢复会话。${scope}\n禁止创建/派发其他代理，禁止 Computer Use；未授权 Git/Memory/网络或扩大范围。工具/路径限制是任务合同，不是OS沙箱。先读必要上下文，只返回有界实际结果、证据、失败与未决项；不得只给状态词。\n${job.task}`;
          const outcome = await ctx.executeTool(p.tool, subagentInput(adapter, job.agent, task, ctx.cwd, modelInputs[i]), { signal });
          const slot = w.state.allocations.find(a => a.id === allocations[i].id)!;
          const notRun = outcome.isError && outcome.durationMs === undefined;
          slot.status = signal?.aborted ? "uncertain" : outcome.isError ? "failed" : "completed";
          // Only a host-confirmed not-run result can undo an unbound logical reservation.
          // Error text or a returned terminal task never releases an occupied slot.
          if (notRun) { releasedReservations.add(slot.id); w.state.allocations = w.state.allocations.filter(a => a.id !== slot.id); }
          else for (const path of job.paths) w.mutate(fileEffect(path) as "content" | "documentation");
          persist(ctx); return { allocation: slot, reservationReleasedBeforeExecution: notRun, outcome };
        }));
        let uncertain = signal?.aborted === true;
        for (let i = 0; i < results.length; i++) if (results[i].status === "rejected") { w.state.allocations.find(a => a.id === allocations[i].id)!.status = "uncertain"; uncertain = true; }
        if (!uncertain) w.state.inFlight = w.state.inFlight.filter(ref => ref !== id);
        else w.pause("部分子任务结果未知，读回实际效果前不能重派");
        const ok = !uncertain && results.every(result => result.status === "fulfilled" && !result.value.outcome.isError);
        w.observe(id, p.tool, "delegate", ok, epochAtDispatch);
        if (ok && p.jobs.every((job: any) => job.role === "Change Verification")) w.observe(`${id}:check`, p.tool, "check", true, epochAtDispatch);
        const body = JSON.stringify(results.map(result => result.status === "fulfilled" ? result.value : { error: String(result.reason) })); pendingResults.set(id, body); persist(ctx);
        return text({ callId: id, results: body.length <= MAX_RESULT ? JSON.parse(body) : body.slice(0, 24000), total: body.length, nextOffset: body.length > MAX_RESULT ? 24000 : null, note: "结果绑定 allocation 与真实调用，不构造 Session ID；须读完实际任务正文。终态不释放预算。" }, !ok);
      } catch (error) { return text(String(error), true); }
      finally { allowedDelegates.delete(id); intents.delete(id); }
    },
  });

  const restore = (ctx: ExtensionContext, navigation = false) => {
    if (volatile() && workflow?.state.sessionId === ctx.sessionManager.getSessionId()) {
      generation++; starting = false; startupError = "";
      workflow.state.verified = undefined; workflow.pause("volatile 仅保留当前进程状态，须读回实际效果"); persist(ctx); return;
    }
    generation++; starting = false; startupError = "";
    if (answerSession !== ctx.sessionManager.getSessionId()) { answers = undefined; ledger = undefined; }
    answerSession = ctx.sessionManager.getSessionId();
    workflow = undefined; enabled = false; restoreError = ""; releasedReservations = new Set(); intents.clear(); allowedDelegates.clear(); observedEffects.clear(); pendingResults.clear();
    try { ledger = volatile() ? ledger : scanLedger(ctx); } catch (error) { enabled = true; restoreError = String(error); return; }
    if (!volatile()) {
      try {
        const latest = [...ctx.sessionManager.getEntries()].reverse().find(e => e.type === "custom" && e.customType === STATE_TYPE && (e.data as { state?: State })?.state?.sessionId === answerSession);
        if (latest?.type === "custom") {
          const data = latest.data as { answers?: StartupAnswers; state: State };
          answers = validateAnswers(data.answers);
          if (answers.mode !== data.state.mode || answers.count !== data.state.childCount || JSON.stringify(answers.audit) !== JSON.stringify(data.state.audit)) throw new Error("会话启动答案与工作流快照冲突");
          if (ledger) answers.count = ledger.count;
        }
      } catch (error) { enabled = true; restoreError = String(error); return; }
      const entry = [...ctx.sessionManager.getBranch()].reverse().find(e => e.type === "custom" && e.customType === STATE_TYPE);
      if (entry?.type === "custom") {
        const envelope = entry.data as { state?: State; enabled?: boolean; error?: string };
        if (!envelope?.state?.sessionId) { enabled = true; restoreError = "工作流快照缺少 Session 身份，不能隐式重置"; return; }
        if (envelope.state.sessionId === ctx.sessionManager.getSessionId()) {
          try {
            if (envelope.error) throw new Error(envelope.error);
            workflow = new Workflow(getCatalog(), restoreState(getCatalog(), envelope.state, ctx.sessionManager.getSessionId(), realpathSync(ctx.cwd)));
            enabled = envelope.enabled === true;
            if (ledger) {
              workflow.state.childCount = ledger.count;
              workflow.state.allocations = ledger.allocations;
              workflow.state.inFlight = [...new Set([...workflow.state.inFlight, ...ledger.inFlight])];
            }
            // File system effects do not rewind with the session tree; restored receipts are not fresh.
            workflow.state.verified = undefined; workflow.state.slice = undefined;
            for (const slot of workflow.state.allocations) if (slot.status === "running") slot.status = "uncertain";
            if (workflow.state.status !== "complete") workflow.pause(navigation ? "分支/会话导航后须读回实际文件及效果；只恢复原位置" : "重载/恢复后须读回当前状态，不自动重放操作");
          } catch (error) { enabled = true; restoreError = String(error); }
        }
      }
    }
    if (ctx.hasUI) ctx.ui.setStatus("coding-workflow", restoreError ? "Coding: 状态需人工恢复" : active() ? "Coding: 等待读回恢复" : undefined);
  };
  pi.on("session_start", (event, ctx) => {
    if (volatile() && !workflow && ["reload", "resume"].includes(event.reason) && (pi.getFlag("coding-mode") || ctx.sessionManager.getEntries().some(e => e.type === "custom_message" && e.customType === CONTEXT_TYPE + ".start" && (e.details as { sessionId?: string } | undefined)?.sessionId === ctx.sessionManager.getSessionId()))) {
      generation++; starting = false; enabled = true;
      restoreError = "volatile 无跨进程/扩展重载恢复证据；请新建 Session，不能把丢失状态当空预算"; return;
    }
    restore(ctx, ["new", "resume", "fork"].includes(event.reason));
  });
  pi.on("session_tree", (_event, ctx) => {
    if (volatile() && workflow?.state.sessionId === ctx.sessionManager.getSessionId()) {
      generation++; starting = false; startupError = "";
      workflow.state.verified = undefined; workflow.pause("volatile 不回放历史流程；保留当前预算/效果，须读回后原位处理"); persist(ctx);
    } else restore(ctx, true);
  });
  pi.on("session_compact", (_event, ctx) => { if (active()) { workflow!.state.verified = undefined; workflow!.pause("压缩后从扩展检查点读回状态；不要依摘要重复效果"); persist(ctx); } });
  pi.on("input", (event, ctx) => {
    if (active() && event.source !== "extension") {
      workflow!.observe(`input:${randomUUID()}`, `user:${event.source}`, "user", true);
      workflow!.state.autoTurns = 0; workflow!.state.lastNudge = -1;
      if (workflow!.state.status !== "complete") workflow!.pause("收到新用户输入：先判断 Contract/授权是否变化，未变则原位恢复；变化须结构化上报"); persist(ctx);
    }
  });
  pi.on("before_agent_start", async (event, ctx) => {
    if (!workflow && !restoreError && pi.getFlag("coding-mode") && event.messageType === "user") {
      try { await requestStart(ctx, startupFlags(pi), event.prompt); }
      catch (error) { reply(ctx, String(error)); }
    }
    if (enabled || starting || startupError) event.systemPromptOptions.sections.coding_workflow = "Coding 扩展已启用：消费每次上下文中的最新 Coding Hooks/检查点。授权、身份、验收为语义判断；扩展状态不授予任何权限，不代替真实工具结果。";
  });
  pi.on("context", event => {
    const messages = event.messages.filter(m => !("customType" in m && m.customType === CONTEXT_TYPE));
    if (starting || startupError) return { messages: [...messages, { role: "custom" as const, customType: CONTEXT_TYPE, content: `[Coding 启动阻断] ${startupError || "正在提问"}。不得执行工具，不得伪造用户答案。`, display: false, timestamp: Date.now() }] };
    if (!enabled) return { messages };
    let content: string;
    try { content = restoreError ? `[Coding 状态阻断] ${restoreError}。保留旧记录，停止依赖写入；不要通过重启任务绕过。` : renderContext(workflow!); }
    catch (error) { content = `[Coding 规则阻断] ${String(error)}。停止依赖操作。`; workflow?.pause(content); }
    return { messages: [...messages, { role: "custom" as const, customType: CONTEXT_TYPE, content, display: false, timestamp: Date.now() }] };
  });
  pi.on("tool_call", (event, ctx) => { const reason = guard(event, ctx); if (reason) return { block: true, reason }; });
  pi.on("tool_execution_end", (event, ctx) => {
    if (!active() || INTERNAL.has(event.toolName)) return;
    const intent = intents.get(event.toolCallId) ?? nearestIntent(event.parentToolCallId);
    if (intent && !intent.delegate) {
      const actuallyRan = event.durationMs !== undefined;
      if (actuallyRan && ["content", "documentation", "git"].includes(intent.effect)) {
        workflow!.mutate(intent.effect as "content" | "documentation" | "git");
        let id = event.parentToolCallId; while (id) { observedEffects.add(id); const i = id.lastIndexOf("/"); id = i >= 0 ? id.slice(0, i) : undefined; }
      }
      workflow!.state.inFlight = workflow!.state.inFlight.filter(id => id !== event.toolCallId);
      workflow!.observe(event.toolCallId, event.toolName, intent.effect, actuallyRan && !event.isError);
      if (event.isError) { if (!workflow!.state.signals.includes("capability_changed")) workflow!.state.signals.push("capability_changed"); }
      persist(ctx);
    }
    intents.delete(event.toolCallId);
  });
  pi.on("user_bash", (_event, ctx) => { if (active()) { for (const dimension of ["content", "documentation", "git"] as const) workflow!.mutate(dimension); workflow!.pause("用户 Shell 的实际影响尚未读回；不从命令名推断无副作用"); persist(ctx); } });
  pi.on("agent_before_settle", (event, ctx) => {
    if (event.outcome !== "completed" || !event.context.canContinue) return;
    if (!active() || restoreError || !workflow!.nudge()) { if (active()) persist(ctx); return; }
    persist(ctx);
    return { continue: true, entries: [{ type: "custom_message", customType: CONTEXT_TYPE + ".continue", content: "Coding 尚有未完成检查点。仅推进已授权且前置齐备的下一步；需要用户/能力/证据时立即 pause/blocked，不要把结构化流程误报为全部完成。", display: false }] };
  });
  pi.on("agent_settled", (event, ctx) => { if (active() && event.aborted) { workflow!.pause("执行被中止；先读回实际效果，再决定恢复"); persist(ctx); } });
  return { getWorkflow: () => workflow, isEnabled: () => enabled, getRestoreError: () => restoreError };
}
