/** Schema adapters only: no sessions, subprocesses, authorization or workflow state. */
import { parseModelSelection, validateChildSelection } from "./model-selection.ts";

interface Schema {
  type?: string; properties?: Record<string, Schema>; required?: string[]; items?: Schema;
  minItems?: number; maxItems?: number; enum?: unknown[]; const?: unknown;
}
export interface SubagentAdapter { kind: "legacy" | "calls"; fields: Record<string, Schema> }
function object(value: unknown): Schema | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const schema = value as Schema;
  if (schema.type !== "object" || !schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) return undefined;
  return schema;
}
function requiredWithin(schema: Schema, names: string[]): boolean {
  return schema.required === undefined || Array.isArray(schema.required) && schema.required.every(name => names.includes(name));
}
function acceptsString(schema: Schema | undefined, value?: string): boolean {
  return schema?.type === "string" && (value === undefined ||
    (schema.enum === undefined || Array.isArray(schema.enum) && schema.enum.includes(value)) &&
    (schema.const === undefined || schema.const === value));
}

export function resolveSubagentAdapter(parameters: unknown): SubagentAdapter | undefined {
  const top = object(parameters);
  if (!top) return undefined;
  // A declared calls interface is never silently reinterpreted as the older API.
  if (top.properties!.calls !== undefined) {
    const calls = top.properties!.calls;
    const item = object(calls?.items);
    if (!calls || calls.type !== "array" || (calls.minItems ?? 0) > 1 || (calls.maxItems ?? 1) < 1 ||
      !requiredWithin(top, ["calls"]) || !item || !requiredWithin(item, ["agent", "prompt", "cwd", "initialContext"])) return undefined;
    const fields = item.properties!;
    if (!["agent", "prompt", "cwd"].every(name => acceptsString(fields[name])) || !acceptsString(fields.initialContext, "empty")) return undefined;
    return { kind: "calls", fields };
  }
  if (!requiredWithin(top, ["agent", "task", "cwd"]) || !["agent", "task", "cwd"].every(name => acceptsString(top.properties![name]))) return undefined;
  return { kind: "legacy", fields: top.properties! };
}
export function compatibleSubagent(parameters: unknown): boolean { return !!resolveSubagentAdapter(parameters); }

/** Run for every job BEFORE reserving allocations or executing any child. */
export function subagentModelInput(adapter: SubagentAdapter, model?: string): Record<string, string> {
  if (model === undefined) return {};
  validateChildSelection(model);
  if (adapter.kind === "legacy") {
    if (!acceptsString(adapter.fields.model, model)) throw new Error("显式模型选择须有真实 model 参数能力；不静默忽略设置");
    return { model };
  }
  const { provider, id, thinking } = parseModelSelection(model);
  const selected = `${provider}/${id}`;
  if (!acceptsString(adapter.fields.model, selected) || !acceptsString(adapter.fields.thinking, thinking)) throw new Error("calls[] 显式选型须有真实 model/thinking 字段及受支持档位；不静默忽略或回退");
  // pi-subagent 3.1.0 applies call > agent > startup thinking separately from model.
  return { model: selected, thinking };
}
export function subagentInput(adapter: SubagentAdapter, agent: string, task: string, cwd: string, modelInput: Record<string, string>): Record<string, unknown> {
  return adapter.kind === "calls"
    ? { calls: [{ agent, prompt: task, cwd, initialContext: "empty", ...modelInput }] }
    : { agent, task, cwd, ...modelInput };
}
