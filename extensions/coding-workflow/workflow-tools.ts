import type {
  ExecuteToolOptions,
  ExtensionAPI,
  ExtensionContext,
  ExtensionToolContext,
} from "@earendil-works/pi-coding-agent";
import { currentModule, hookDocument, rewriteWorkflowLinks } from "./catalog.ts";
import { runDelegation } from "./delegation.ts";
import type { Workflow } from "./engine.ts";
import { affectsEpoch, scopedPath, WORKFLOW_TOOL_NAMES, type ToolCallState } from "./tool-guards.ts";
import type { CheckpointInput, RunInput, WorkflowToolSchemas } from "./tool-schemas.ts";
import { workflowStatus } from "./workflow-context.ts";

const MAX_RESULT = 64000;
const RESULT_PAGE_SIZE = 24000;

interface ToolHost {
  calls: ToolCallState;
  requireWorkflow(): Workflow;
  isDelegate(name: string): boolean;
  persist(context: ExtensionContext): void;
}

function toolResult(value: unknown, isError = false) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text" as const, text }], details: {}, isError };
}

function readRules(workflow: Workflow, query: Extract<CheckpointInput, { action: "rules" }>) {
  const { catalog, state } = workflow;
  const module = currentModule(catalog, state.phase, state.mode);
  const selected = query.document ?? hookDocument(module.hook);
  const legacyModule = catalog.modules[selected];
  const document = catalog.references.document(legacyModule ? hookDocument(legacyModule.hook) : selected);

  if (query.fragment === undefined) {
    const fragments = document.fragments.map(({ id, kind, title }) => ({ id, kind, title }));
    return { document: document.id, title: document.title, fragments };
  }
  const body = catalog.references.readFragment(document.id, query.fragment);
  const content = rewriteWorkflowLinks(catalog, document.path, body);
  if (content.length > MAX_RESULT) {
    throw new Error(`规则片段超出读取上限：${document.id}#${query.fragment}`);
  }
  return { document: document.id, fragment: query.fragment, content };
}

function readResultPage(
  results: ToolCallState["results"],
  query: Extract<CheckpointInput, { action: "result" }>,
) {
  const result = results.get(query.resultId);
  if (result === undefined) throw new Error("结果已不可用；不要重跑任务，按实际调用记录核验");
  const offset = query.offset ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("offset 无效");

  const end = offset + RESULT_PAGE_SIZE;
  return {
    resultId: query.resultId,
    offset,
    total: result.length,
    content: result.slice(offset, end),
    nextOffset: end < result.length ? end : null,
  };
}

type CheckpointChange = Exclude<CheckpointInput, { action: "status" | "rules" | "result" }>;

function applyCheckpointChange(workflow: Workflow, change: CheckpointChange): void {
  switch (change.action) {
    case "report":
      workflow.report(change.revision, change.reports);
      return;
    case "signal":
      workflow.signal(change.revision, change);
      return;
    case "pause":
      workflow.assertRevision(change.revision);
      workflow.pause(change.reason);
      return;
    case "resume":
      workflow.resume(change.revision, change.evidence);
      return;
    case "resolve_effect":
      workflow.resolveEffect(change.revision, change.callId, change.evidence);
      return;
    default:
      throw new Error("未知控制动作");
  }
}

function registerControlTools(pi: ExtensionAPI, schemas: WorkflowToolSchemas, host: ToolHost) {
  pi.registerTool({
    name: "coding_checkpoint",
    label: "Coding 检查点",
    description:
      "按 ID 查询规则片段，或记录当前同模块检查点、语义信号、暂停/原位恢复和未知效果读回；不授予权限",
    parameters: schemas.checkpoint,
    executionMode: "sequential",
    exposure: "model-only",
    async execute(_id, input, _signal, _update, context) {
      try {
        const workflow = host.requireWorkflow();
        if (input.action === "status") return toolResult(workflowStatus(workflow, input.offset));
        if (input.action === "rules") return toolResult(readRules(workflow, input));
        if (input.action === "result") return toolResult(readResultPage(host.calls.results, input));

        applyCheckpointChange(workflow, input);
        host.persist(context);
        return toolResult(workflowStatus(workflow));
      } catch (error) {
        return toolResult(String(error), true);
      }
    },
  });
  pi.registerTool({
    name: "coding_slice",
    label: "Coding Slice",
    description:
      "放行有界 Slice：Objective、精确路径/影响、Return conditions、Unreleased boundary，须有当前授权与计划依据",
    parameters: schemas.slice,
    executionMode: "sequential",
    exposure: "model-only",
    async execute(_id, input, _signal, _update, context) {
      try {
        const workflow = host.requireWorkflow();
        for (const path of input.slice.paths) {
          if (scopedPath(context.cwd, path) !== path) throw new Error("路径须使用规范项目相对路径");
        }
        workflow.release(input.revision, input.slice);
        host.persist(context);
        return toolResult(workflowStatus(workflow));
      } catch (error) {
        return toolResult(String(error), true);
      }
    },
  });
}

function reachedTool(input: Record<string, unknown>): string[] {
  return typeof input.tool === "string" ? [input.tool] : [];
}

interface OpaqueToolCall {
  callId: string;
  input: RunInput;
  options: ExecuteToolOptions;
}

type ToolExecutionHost = ToolHost & { context: ExtensionToolContext };
type ToolOutcome = Awaited<ReturnType<ExtensionToolContext["executeTool"]>>;

function checkRunRequest(workflow: Workflow, input: RunInput, host: ToolExecutionHost): void {
  workflow.assertRevision(input.revision);
  const { tool, effect, evidence } = input;
  if (
    WORKFLOW_TOOL_NAMES.has(tool) ||
    host.isDelegate(tool) ||
    !host.context.tools.some((available) => available.name === tool)
  ) {
    throw new Error("工具不存在/hidden/递归/子代理旁路；先发现真实工具与 Schema");
  }
  const observations = workflow.state.observations;
  const validEvidence =
    Array.isArray(evidence) &&
    evidence.length > 0 &&
    evidence.every((id) => observations.some((observation) => observation.id === id));
  if (!input.rationale?.trim() || !validEvidence) {
    throw new Error("缺少效果分类依据和真实授权/上下文证据引用");
  }
  const blocked = workflow.canRun(effect);
  if (blocked) throw new Error(blocked);
}

function storeRunReceipt(host: ToolExecutionHost, callId: string, outcome: ToolOutcome) {
  // 完整工具正文留给后续分页，分页只读取收据缓存。
  const body = JSON.stringify(outcome.result);
  host.calls.results.set(callId, body);
  host.persist(host.context);

  const paged = body.length > MAX_RESULT;
  return toolResult(
    {
      callId,
      isError: outcome.isError,
      total: body.length,
      result: paged ? body.slice(0, RESULT_PAGE_SIZE) : outcome.result,
      nextOffset: paged ? RESULT_PAGE_SIZE : null,
      note: paged ? "用 coding_checkpoint result 分页读完；不可仅凭摘要接受结果" : undefined,
    },
    outcome.isError,
  );
}

async function runOpaqueTool(workflow: Workflow, call: OpaqueToolCall, host: ToolExecutionHost) {
  const { callId, input, options } = call;
  const { calls, context } = host;

  // 保存调用中状态后再进入宿主工具，中断恢复才能定位具体调用。
  calls.intents.set(callId, { effect: input.effect });
  workflow.state.inFlight.push(callId);
  host.persist(context);
  const epochAtCall = structuredClone(workflow.state.epoch);
  const outcome = await context.executeTool(input.tool, input.input, options);

  if (options.signal?.aborted) {
    workflow.pause("调用被中止：须先读回实际效果，不自动重试");
  } else {
    workflow.state.inFlight = workflow.state.inFlight.filter((id) => id !== callId);
  }
  const actuallyRan = outcome.durationMs !== undefined;
  workflow.observe(
    {
      id: callId,
      tool: input.tool,
      effect: input.effect,
      ok: actuallyRan && !outcome.isError && !options.signal?.aborted,
    },
    epochAtCall,
  );
  if (actuallyRan && affectsEpoch(input.effect) && !calls.observedMutations.has(callId)) {
    workflow.mutate(input.effect);
  }

  return storeRunReceipt(host, callId, outcome);
}

function registerRunTool(pi: ExtensionAPI, schemas: WorkflowToolSchemas, host: ToolHost) {
  const { calls } = host;
  pi.registerTool({
    name: "coding_run",
    label: "Coding 显式影响调用",
    description:
      "经宿主实际工具链运行已授权的不透明工具；effect 是声明，不是命令安全证明。只调用真实可调用工具，不绕过 hidden/审批。",
    parameters: schemas.run,
    executionMode: "sequential",
    exposure: "model-only",
    reachesTools: reachedTool,
    async execute(callId, input, signal, onUpdate, context) {
      const workflow = host.requireWorkflow();
      const executionHost = { ...host, context };
      try {
        checkRunRequest(workflow, input, executionHost);
        return await runOpaqueTool(workflow, { callId, input, options: { signal, onUpdate } }, executionHost);
      } catch (error) {
        if (workflow.state.inFlight.includes(callId))
          workflow.pause("不透明调用中断：效果未知，须读回，禁止自动重放");
        host.persist(context);
        return toolResult(String(error), true);
      } finally {
        calls.intents.delete(callId);
      }
    },
  });
}

function registerDelegateTool(pi: ExtensionAPI, schemas: WorkflowToolSchemas, host: ToolHost) {
  pi.registerTool({
    name: "coding_delegate",
    label: "Coding 有界委派",
    description:
      "经实际 Schema 适配 agent/task/cwd 或 calls[] 一次性子任务；串行预留职责预算后并行独立任务，不传 session、不假装持久复用。",
    parameters: schemas.delegate,
    executionMode: "sequential",
    exposure: "model-only",
    reachesTools: reachedTool,
    async execute(callId, input, signal, _update, context) {
      try {
        const workflow = host.requireWorkflow();
        const { body, ok } = await runDelegation(
          workflow,
          { callId, input, signal },
          {
            context,
            calls: host.calls,
            isDelegate: host.isDelegate,
            persist: host.persist,
          },
        );
        const paged = body.length > MAX_RESULT;
        const results: unknown = paged ? body.slice(0, RESULT_PAGE_SIZE) : JSON.parse(body);
        return toolResult(
          {
            callId,
            results,
            total: body.length,
            nextOffset: paged ? RESULT_PAGE_SIZE : null,
            note: "结果绑定 allocation 与真实调用，不构造 Session ID；须读完实际任务正文。终态不释放预算。",
          },
          !ok,
        );
      } catch (error) {
        return toolResult(String(error), true);
      }
    },
  });
}

export function registerWorkflowTools(pi: ExtensionAPI, schemas: WorkflowToolSchemas, host: ToolHost): void {
  registerControlTools(pi, schemas, host);
  registerRunTool(pi, schemas, host);
  registerDelegateTool(pi, schemas, host);
}
