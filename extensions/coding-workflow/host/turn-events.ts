import { randomUUID } from "node:crypto";
import { startupFlags } from "../startup.ts";
import { renderContext } from "../workflow-context.ts";
import { CONTEXT_TYPE, type RuntimeSession } from "./runtime-session.ts";
import { requestStart } from "./workflow-commands.ts";

function contextMessage(content: string) {
  return {
    role: "custom" as const,
    customType: CONTEXT_TYPE,
    content,
    display: false,
    timestamp: Date.now(),
  };
}

function workflowContext(runtime: RuntimeSession): string {
  if (runtime.restoreError) {
    return `[Coding 状态阻断] ${runtime.restoreError}。保留旧记录，停止依赖写入；不要通过重启任务绕过。`;
  }
  try {
    return renderContext(runtime.requireWorkflow());
  } catch (error) {
    const content = `[Coding 规则阻断] ${String(error)}。停止依赖操作。`;
    runtime.workflow?.pause(content);
    return content;
  }
}

function registerContextHook(runtime: RuntimeSession): void {
  runtime.pi.on("context", (event) => {
    const messages = event.messages.filter(
      (message) => !("customType" in message && message.customType === CONTEXT_TYPE),
    );
    if (runtime.starting || runtime.startupError) {
      const content = `[Coding 启动阻断] ${runtime.startupError || "正在提问"}。不得执行工具，不得伪造用户答案。`;
      return { messages: [...messages, contextMessage(content)] };
    }
    if (!runtime.enabled) return { messages };
    return { messages: [...messages, contextMessage(workflowContext(runtime))] };
  });
}

function registerUserInput(runtime: RuntimeSession): void {
  runtime.pi.on("input", (event, context) => {
    const current = runtime.activeWorkflow();
    if (!current || event.source === "extension") return;
    current.observe({ id: `input:${randomUUID()}`, tool: `user:${event.source}`, effect: "user", ok: true });
    current.state.autoTurns = 0;
    current.state.lastNudge = -1;
    if (current.state.status !== "complete") {
      current.pause("收到新用户输入：先判断 Contract/授权是否变化，未变则原位恢复；变化须结构化上报");
    }
    runtime.persist(context);
  });
  runtime.pi.on("before_agent_start", async (event, context) => {
    if (
      !runtime.workflow &&
      !runtime.restoreError &&
      runtime.pi.getFlag("coding-mode") &&
      event.messageType === "user"
    ) {
      try {
        await requestStart(runtime, context, { input: startupFlags(runtime.pi), task: event.prompt });
      } catch (error) {
        runtime.reply(context, String(error));
      }
    }
    if (runtime.enabled || runtime.starting || runtime.startupError) {
      event.systemPromptOptions.sections.coding_workflow =
        "Coding 扩展已启用：消费每次上下文中的最新 Coding Hooks/检查点。授权、身份、验收为语义判断；扩展状态不授予任何权限，不代替真实工具结果。";
    }
  });
}

function registerTurnCompletion(runtime: RuntimeSession): void {
  runtime.pi.on("agent_before_settle", (event, context) => {
    if (event.outcome !== "completed" || !event.context.canContinue) return;
    const current = runtime.activeWorkflow();
    if (!current) return;
    const canContinue = !runtime.restoreError && current.nudge();
    runtime.persist(context);
    if (!canContinue) return;
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
  runtime.pi.on("agent_settled", (event, context) => {
    const current = runtime.activeWorkflow();
    if (!current || !event.aborted) return;
    current.pause("执行被中止；先读回实际效果，再决定恢复");
    runtime.persist(context);
  });
}

export function registerTurnHooks(runtime: RuntimeSession): void {
  registerUserInput(runtime);
  registerContextHook(runtime);
  registerTurnCompletion(runtime);
}
