import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import type { ExtensionAPI, ExtensionContext, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { loadCatalog, type Catalog, type Mode } from "./catalog.ts";
import { makeState, restoreState, Workflow, type State } from "./engine.ts";
import {
  collectStartup,
  parseStartupCommand,
  registerStartupFlags,
  startupFlags,
  validateAnswers,
  type StartupAnswers,
  type StartupInput,
} from "./startup.ts";
import { compatibleSubagent } from "./subagent-adapter.ts";
import {
  affectsEpoch,
  fileEffect,
  nearestIntent,
  parentCallId,
  scopedPath,
  WORKFLOW_TOOL_NAMES,
  type ToolCallState,
} from "./tool-guards.ts";
import type { WorkflowToolSchemas } from "./tool-schemas.ts";
import { renderContext, workflowStatus } from "./workflow-context.ts";
import { registerWorkflowTools } from "./workflow-tools.ts";

export { compatibleSubagent } from "./subagent-adapter.ts";
export { fileEffect, scopedPath } from "./tool-guards.ts";
export { MAX_CONTEXT, renderContext, renderHook } from "./workflow-context.ts";

export type Schemas = WorkflowToolSchemas;

const STATE_TYPE = "token-io.coding-workflow.v1";
const CONTEXT_TYPE = "token-io.coding-hooks.v1";
const READ_TOOLS = new Set(["read", "grep", "find", "ls", "tool_search"]);

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
  let ledger:
    { mode: Mode; count: number; allocations: State["allocations"]; inFlight: string[] } | undefined;
  const calls: ToolCallState = {
    intents: new Map(),
    allowedDelegates: new Set(),
    observedMutations: new Set(),
    releasedReservations: new Set(),
    results: new Map(),
  };
  const getCatalog = () => (catalog ??= loadCatalog());
  const volatile = () => pi.getFlag("coding-volatile") === true;
  const activeWorkflow = () => (enabled ? workflow : undefined);
  function requireWorkflow() {
    const current = activeWorkflow();
    if (!current || restoreError) {
      throw new Error(
        restoreError || "先由用户通过 /coding start 或 single|multi [数量] <任务> 完成启动收集",
      );
    }
    return current;
  }
  function persist(ctx: ExtensionContext) {
    if (!volatile()) {
      pi.appendEntry(STATE_TYPE, {
        enabled,
        state: workflow?.snapshot(),
        answers,
        error: restoreError,
        releasedReservations: [...calls.releasedReservations],
      });
    }
    if (!ctx.hasUI) return;

    const current = activeWorkflow();
    if (current) {
      const { mode, phase, status } = current.state;
      ctx.ui.setStatus(
        "coding-workflow",
        `Coding ${mode} · ${phase}/${current.checkpoint?.id ?? "done"} · ${status}`,
      );
      return;
    }
    ctx.ui.setStatus("coding-workflow", restoreError ? "Coding: 状态需人工恢复" : undefined);
  }
  function reply(ctx: ExtensionContext, message: string) {
    if (ctx.hasUI) ctx.ui.notify(message, "info");
    else pi.sendMessage({ customType: CONTEXT_TYPE + ".notice", content: message, display: true });
  }
  function scanLedger(ctx: ExtensionContext) {
    const envelopes = ctx.sessionManager
      .getEntries()
      .filter((e) => e.type === "custom" && e.customType === STATE_TYPE)
      .map((e) => (e as { data?: { state?: State; releasedReservations?: string[] } }).data)
      .filter(
        (e) =>
          e?.state?.sessionId === ctx.sessionManager.getSessionId() && e.state.cwd === realpathSync(ctx.cwd),
      );
    const snapshots = envelopes.map((e) => e!.state!);
    if (!snapshots.length) return undefined;
    calls.releasedReservations = new Set(envelopes.flatMap((e) => e!.releasedReservations ?? []));
    const slots = new Map<string, State["allocations"][number]>();
    const runs = new Map<string, State>();
    for (const state of snapshots) {
      restoreState(getCatalog(), state, ctx.sessionManager.getSessionId(), realpathSync(ctx.cwd));
      if (
        !Array.isArray(state.allocations) ||
        !Array.isArray(state.inFlight) ||
        !Number.isSafeInteger(state.childCount)
      )
        throw new Error("会话级预算历史损坏，不能重置");
      for (const slot of state.allocations)
        if (!calls.releasedReservations.has(slot.id)) slots.set(slot.id, structuredClone(slot));
      runs.set(state.runId, state);
    }
    const last = snapshots.at(-1)!;
    return {
      mode: last.mode,
      count: Math.max(...snapshots.map((s) => s.childCount)),
      allocations: [...slots.values()],
      inFlight: [...new Set([...runs.values()].flatMap((s) => s.inFlight))],
    };
  }
  function clearCallTracking() {
    calls.intents.clear();
    calls.allowedDelegates.clear();
    calls.observedMutations.clear();
    calls.results.clear();
  }
  function start(ctx: ExtensionContext, startup: StartupAnswers, task: string) {
    const { mode, count, audit } = startup;
    if (restoreError) throw new Error(restoreError);
    if (
      volatile() &&
      !workflow &&
      ctx.sessionManager
        .getEntries()
        .some(
          (e) =>
            e.type === "custom_message" &&
            e.customType === CONTEXT_TYPE + ".start" &&
            (e.details as { sessionId?: string } | undefined)?.sessionId ===
              ctx.sessionManager.getSessionId(),
        )
    )
      throw new Error("volatile 历史存在但当前进程状态不可恢复；请使用新 Session，不能假设预算清空");
    ledger = volatile() ? ledger : (scanLedger(ctx) ?? ledger);
    if (ledger && (ledger.mode !== mode || ledger.count !== count || ledger.inFlight.length))
      throw new Error(
        "整个 Session 的模式/预算仍锁定或有未知效果；树导航不是重置授权，请恢复原任务或新建 Session",
      );
    if (workflow && workflow.state.sessionId === ctx.sessionManager.getSessionId()) {
      if (workflow.state.status !== "complete")
        throw new Error("已有任务；使用 status / pause / resume，不能重建状态绕过预算或重复效果");
      if (workflow.state.mode !== mode || workflow.state.childCount !== count)
        throw new Error("同 Session 已锁定 Mode/count；新路线请使用新 Session，扩容须显式 add-slot");
    }
    const previous = workflow;
    workflow = new Workflow(
      getCatalog(),
      makeState(getCatalog(), ctx.sessionManager.getSessionId(), realpathSync(ctx.cwd), mode, count, task),
    );
    if (previous || ledger)
      workflow.state.allocations = structuredClone(previous?.state.allocations ?? ledger!.allocations);
    workflow.state.audit = structuredClone(audit);
    enabled = true;
    workflow.observe(`command:${randomUUID()}`, "/coding", "user", true);
    clearCallTracking();
    persist(ctx);
  }
  async function requestStart(ctx: ExtensionContext, input: StartupInput, task: string) {
    if (starting) throw new Error("已有启动提问进行中；不能并发或重复启动");
    if (restoreError) throw new Error(restoreError);
    if (workflow && workflow.state.status !== "complete") throw new Error("已有任务；不能重建状态");
    const token = ++generation;
    const session = ctx.sessionManager.getSessionId();
    starting = true;
    startupError = "启动答案未完成；禁止执行工具";
    try {
      const current = () => {
        if (token !== generation || ctx.sessionManager.getSessionId() !== session)
          throw new Error("启动已取消：Session/树导航发生变化");
      };
      const collected = await collectStartup(ctx, input, answers, current);
      current();
      const previous = answers;
      answers = collected;
      try {
        start(ctx, collected, task);
      } catch (error) {
        answers = previous;
        throw error;
      }
      answerSession = session;
      startupError = "";
    } catch (error) {
      if (token === generation) startupError = String(error);
      throw error;
    } finally {
      if (token === generation) starting = false;
    }
  }
  function isDelegate(name: string) {
    return pi
      .getAllTools()
      .some((t) => t.name === name && (compatibleSubagent(t.parameters) || name === "subagent"));
  }
  function readOnly(name: string) {
    return READ_TOOLS.has(name);
  }
  function guard(event: ToolCallEvent, ctx: ExtensionContext): string | undefined {
    if (starting || startupError) return startupError || "启动进行中；禁止执行工具";
    if (!enabled) return undefined;
    if (restoreError)
      return WORKFLOW_TOOL_NAMES.has(event.toolName) || readOnly(event.toolName) ? undefined : restoreError;
    const w = workflow!;
    if (WORKFLOW_TOOL_NAMES.has(event.toolName)) return undefined;
    if (isDelegate(event.toolName)) {
      if (!event.parentToolCallId || !calls.allowedDelegates.has(event.parentToolCallId))
        return "子任务必须经 coding_delegate 预算、角色、任务和实际 Schema 门禁；不允许直接或脚本旁路";
      return undefined;
    }
    if (event.toolName === "edit" || event.toolName === "write") {
      try {
        const path = scopedPath(ctx.cwd, event.input.path);
        const effect = fileEffect(path);
        const block = w.canRun(effect, path);
        if (!block) {
          calls.intents.set(event.toolCallId, { effect });
          w.state.inFlight.push(event.toolCallId);
          persist(ctx);
        }
        return block;
      } catch (error) {
        return String(error);
      }
    }
    if (readOnly(event.toolName)) {
      calls.intents.set(event.toolCallId, { effect: "read" });
      return undefined;
    }
    const intent = nearestIntent(calls.intents, event.parentToolCallId);
    if (!intent || intent.delegate)
      return "不透明工具须通过 coding_run 声明影响、依据和当前 Slice；不根据 Shell 名称猜测安全性";
    const block = w.canRun(intent.effect);
    if (!block) calls.intents.set(event.toolCallId, intent);
    return block;
  }

  registerStartupFlags(pi);
  pi.registerFlag("coding-volatile", {
    description: "不额外 appendEntry；状态仅存当前进程，Pi 自身日志需另用 --no-session 管理",
    type: "boolean",
    default: false,
  });
  pi.registerCommand("coding", {
    description:
      "Coding start <任务> | single <任务> | multi [数量] <任务> | status | pause | resume | off | add-slot <完整职责名>",
    handler: async (args, ctx) => {
      try {
        const input = args.trim();
        let request;
        try {
          request = parseStartupCommand(input);
        } catch (error) {
          if (!workflow && !starting) startupError = String(error);
          throw error;
        }
        if (request) {
          await requestStart(ctx, request.input, request.task);
          pi.sendMessage(
            {
              customType: CONTEXT_TYPE + ".start",
              details: { sessionId: ctx.sessionManager.getSessionId() },
              content:
                "用户已通过 /coding 明确选择路线与目标。按当前 Coding Hooks 开始，先核验 Contract/能力；模式选择不授权写入、Memory 或子任务。",
              display: true,
            },
            { triggerTurn: true },
          );
          return;
        }
        if (input === "status" || !input) {
          reply(
            ctx,
            workflow
              ? JSON.stringify(workflowStatus(workflow), null, 2)
              : restoreError || startupError || "未启用。/coding start <任务> 或 single|multi [数量] <任务>",
          );
          return;
        }
        if (input === "cancel" && starting) {
          generation++;
          starting = false;
          startupError = "启动已取消；没有创建 Workflow";
          return;
        }
        if (!workflow || restoreError) throw new Error(restoreError || "没有可恢复的任务");
        if (input === "pause" || input === "off") {
          workflow.pause(input === "off" ? "用户停用扩展；恢复前须读取实际状态" : "用户暂停");
          if (input === "off") {
            enabled = false;
            workflow.state.verified = undefined;
          }
          persist(ctx);
          return;
        }
        if (input === "resume") {
          enabled = true;
          workflow.state.autoTurns = 0;
          workflow.state.lastNudge = -1;
          workflow.observe(`command:${randomUUID()}`, "/coding resume", "user", true);
          // Remain paused until the agent supplies readback evidence through the control tool.
          persist(ctx);
          pi.sendMessage(
            {
              customType: CONTEXT_TYPE + ".resume",
              content:
                "用户要求恢复。先读回原暂停点、已完成效果及当前状态；用 coding_checkpoint resume/resolve_effect，勿重放命令。",
              display: true,
            },
            { triggerTurn: true },
          );
          return;
        }
        if (input.startsWith("add-slot ")) {
          workflow.addSlot(input.slice(9));
          if (answers) answers.count = workflow.state.childCount;
          workflow.observe(`command:${randomUUID()}`, "/coding add-slot", "user", true);
          persist(ctx);
          return;
        }
        throw new Error(
          "未知命令；/coding status 查看状态。支持 start、single、multi、cancel、pause、resume、off、add-slot。",
        );
      } catch (error) {
        reply(ctx, String(error));
      }
    },
  });
  registerWorkflowTools(pi, schemas, { calls, requireWorkflow, isDelegate, persist });

  const restore = (ctx: ExtensionContext, navigation = false) => {
    if (volatile() && workflow?.state.sessionId === ctx.sessionManager.getSessionId()) {
      generation++;
      starting = false;
      startupError = "";
      workflow.state.checked = undefined;
      workflow.state.verified = undefined;
      workflow.pause("volatile 仅保留当前进程状态，须读回实际效果");
      persist(ctx);
      return;
    }
    generation++;
    starting = false;
    startupError = "";
    if (answerSession !== ctx.sessionManager.getSessionId()) {
      answers = undefined;
      ledger = undefined;
    }
    answerSession = ctx.sessionManager.getSessionId();
    workflow = undefined;
    enabled = false;
    restoreError = "";
    calls.releasedReservations = new Set();
    clearCallTracking();
    try {
      ledger = volatile() ? ledger : scanLedger(ctx);
    } catch (error) {
      enabled = true;
      restoreError = String(error);
      return;
    }
    if (!volatile()) {
      try {
        const latest = [...ctx.sessionManager.getEntries()]
          .reverse()
          .find(
            (e) =>
              e.type === "custom" &&
              e.customType === STATE_TYPE &&
              (e.data as { state?: State })?.state?.sessionId === answerSession,
          );
        if (latest?.type === "custom") {
          const data = latest.data as { answers?: StartupAnswers; state: State };
          answers = validateAnswers(data.answers);
          if (
            answers.mode !== data.state.mode ||
            answers.count !== data.state.childCount ||
            JSON.stringify(answers.audit) !== JSON.stringify(data.state.audit)
          )
            throw new Error("会话启动答案与工作流快照冲突");
          if (ledger) answers.count = ledger.count;
        }
      } catch (error) {
        enabled = true;
        restoreError = String(error);
        return;
      }
      const entry = [...ctx.sessionManager.getBranch()]
        .reverse()
        .find((e) => e.type === "custom" && e.customType === STATE_TYPE);
      if (entry?.type === "custom") {
        const envelope = entry.data as { state?: State; enabled?: boolean; error?: string };
        if (!envelope?.state?.sessionId) {
          enabled = true;
          restoreError = "工作流快照缺少 Session 身份，不能隐式重置";
          return;
        }
        if (envelope.state.sessionId === ctx.sessionManager.getSessionId()) {
          try {
            if (envelope.error) throw new Error(envelope.error);
            workflow = new Workflow(
              getCatalog(),
              restoreState(
                getCatalog(),
                envelope.state,
                ctx.sessionManager.getSessionId(),
                realpathSync(ctx.cwd),
              ),
            );
            enabled = envelope.enabled === true;
            if (ledger) {
              workflow.state.childCount = ledger.count;
              workflow.state.allocations = ledger.allocations;
              workflow.state.inFlight = [...new Set([...workflow.state.inFlight, ...ledger.inFlight])];
            }
            // File system effects do not rewind with the session tree; restored receipts are not fresh.
            workflow.state.checked = undefined;
            workflow.state.verified = undefined;
            workflow.state.slice = undefined;
            for (const slot of workflow.state.allocations)
              if (slot.status === "running") slot.status = "uncertain";
            if (workflow.state.status !== "complete")
              workflow.pause(
                navigation
                  ? "分支/会话导航后须读回实际文件及效果；只恢复原位置"
                  : "重载/恢复后须读回当前状态，不自动重放操作",
              );
          } catch (error) {
            enabled = true;
            restoreError = String(error);
          }
        }
      }
    }
    if (ctx.hasUI)
      ctx.ui.setStatus(
        "coding-workflow",
        restoreError ? "Coding: 状态需人工恢复" : activeWorkflow() ? "Coding: 等待读回恢复" : undefined,
      );
  };
  pi.on("session_start", (event, ctx) => {
    if (
      volatile() &&
      !workflow &&
      ["reload", "resume"].includes(event.reason) &&
      (pi.getFlag("coding-mode") ||
        ctx.sessionManager
          .getEntries()
          .some(
            (e) =>
              e.type === "custom_message" &&
              e.customType === CONTEXT_TYPE + ".start" &&
              (e.details as { sessionId?: string } | undefined)?.sessionId ===
                ctx.sessionManager.getSessionId(),
          ))
    ) {
      generation++;
      starting = false;
      enabled = true;
      restoreError = "volatile 无跨进程/扩展重载恢复证据；请新建 Session，不能把丢失状态当空预算";
      return;
    }
    restore(ctx, ["new", "resume", "fork"].includes(event.reason));
  });
  pi.on("session_tree", (_event, ctx) => {
    if (volatile() && workflow?.state.sessionId === ctx.sessionManager.getSessionId()) {
      generation++;
      starting = false;
      startupError = "";
      workflow.state.checked = undefined;
      workflow.state.verified = undefined;
      workflow.pause("volatile 不回放历史流程；保留当前预算/效果，须读回后原位处理");
      persist(ctx);
    } else restore(ctx, true);
  });
  pi.on("session_compact", (_event, ctx) => {
    const current = activeWorkflow();
    if (!current) return;
    current.state.checked = undefined;
    current.state.verified = undefined;
    current.pause("压缩后从扩展检查点读回状态；不要依摘要重复效果");
    persist(ctx);
  });
  pi.on("input", (event, ctx) => {
    const current = activeWorkflow();
    if (!current || event.source === "extension") return;
    current.observe(`input:${randomUUID()}`, `user:${event.source}`, "user", true);
    current.state.autoTurns = 0;
    current.state.lastNudge = -1;
    if (current.state.status !== "complete") {
      current.pause("收到新用户输入：先判断 Contract/授权是否变化，未变则原位恢复；变化须结构化上报");
    }
    persist(ctx);
  });
  pi.on("before_agent_start", async (event, ctx) => {
    if (!workflow && !restoreError && pi.getFlag("coding-mode") && event.messageType === "user") {
      try {
        await requestStart(ctx, startupFlags(pi), event.prompt);
      } catch (error) {
        reply(ctx, String(error));
      }
    }
    if (enabled || starting || startupError)
      event.systemPromptOptions.sections.coding_workflow =
        "Coding 扩展已启用：消费每次上下文中的最新 Coding Hooks/检查点。授权、身份、验收为语义判断；扩展状态不授予任何权限，不代替真实工具结果。";
  });
  pi.on("context", (event) => {
    const messages = event.messages.filter((m) => !("customType" in m && m.customType === CONTEXT_TYPE));
    if (starting || startupError)
      return {
        messages: [
          ...messages,
          {
            role: "custom" as const,
            customType: CONTEXT_TYPE,
            content: `[Coding 启动阻断] ${startupError || "正在提问"}。不得执行工具，不得伪造用户答案。`,
            display: false,
            timestamp: Date.now(),
          },
        ],
      };
    if (!enabled) return { messages };
    let content: string;
    try {
      content = restoreError
        ? `[Coding 状态阻断] ${restoreError}。保留旧记录，停止依赖写入；不要通过重启任务绕过。`
        : renderContext(workflow!);
    } catch (error) {
      content = `[Coding 规则阻断] ${String(error)}。停止依赖操作。`;
      workflow?.pause(content);
    }
    return {
      messages: [
        ...messages,
        { role: "custom" as const, customType: CONTEXT_TYPE, content, display: false, timestamp: Date.now() },
      ],
    };
  });
  pi.on("tool_call", (event, ctx) => {
    const reason = guard(event, ctx);
    if (reason) return { block: true, reason };
  });
  pi.on("tool_execution_end", (event, ctx) => {
    const current = activeWorkflow();
    if (!current || WORKFLOW_TOOL_NAMES.has(event.toolName)) return;
    const intent =
      calls.intents.get(event.toolCallId) ?? nearestIntent(calls.intents, event.parentToolCallId);
    if (intent && !intent.delegate) {
      const actuallyRan = event.durationMs !== undefined;
      if (actuallyRan && affectsEpoch(intent.effect)) {
        current.mutate(intent.effect);
        for (let id = event.parentToolCallId; id; id = parentCallId(id)) {
          calls.observedMutations.add(id);
        }
      }
      current.state.inFlight = current.state.inFlight.filter((id) => id !== event.toolCallId);
      current.observe(event.toolCallId, event.toolName, intent.effect, actuallyRan && !event.isError);
      if (event.isError && !current.state.signals.includes("capability_changed")) {
        current.state.signals.push("capability_changed");
      }
      persist(ctx);
    }
    calls.intents.delete(event.toolCallId);
  });
  pi.on("user_bash", (_event, ctx) => {
    const current = activeWorkflow();
    if (!current) return;
    for (const dimension of ["content", "documentation", "git"] as const) current.mutate(dimension);
    current.pause("用户 Shell 的实际影响尚未读回；不从命令名推断无副作用");
    persist(ctx);
  });
  pi.on("agent_before_settle", (event, ctx) => {
    if (event.outcome !== "completed" || !event.context.canContinue) return;
    const current = activeWorkflow();
    if (!current) return;
    if (restoreError || !current.nudge()) {
      persist(ctx);
      return;
    }
    persist(ctx);
    return {
      continue: true,
      entries: [
        {
          type: "custom_message",
          customType: CONTEXT_TYPE + ".continue",
          content:
            "Coding 尚有未完成检查点。仅推进已授权且前置齐备的下一步；需要用户/能力/证据时立即 pause/blocked，不要把结构化流程误报为全部完成。",
          display: false,
        },
      ],
    };
  });
  pi.on("agent_settled", (event, ctx) => {
    const current = activeWorkflow();
    if (!current || !event.aborted) return;
    current.pause("执行被中止；先读回实际效果，再决定恢复");
    persist(ctx);
  });
  return { getWorkflow: () => workflow, isEnabled: () => enabled, getRestoreError: () => restoreError };
}
