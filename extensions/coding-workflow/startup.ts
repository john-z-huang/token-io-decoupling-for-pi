import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Mode } from "./catalog.ts";

export type Source = "explicit" | "default";
export interface Audit {
  audit_mode: string;
  root_reasoning_cadence: string;
  worker_reasoning_cadence: string;
  source: Record<AuditKey, Source>;
}
type AuditKey = "audit_mode" | "root_reasoning_cadence" | "worker_reasoning_cadence";
export interface StartupAnswers {
  mode: Mode;
  count: number;
  audit: Audit;
}
export interface StartupInput {
  mode?: string;
  count?: string;
  defaults?: boolean;
  audit?: Partial<Record<AuditKey, string>>;
}
interface Draft {
  mode?: Mode;
  count?: number;
  audit: Partial<Omit<Audit, "source">> & { source: Partial<Record<AuditKey, Source>> };
}
const FIELDS = [
  {
    key: "audit_mode",
    flag: "coding-audit-mode",
    values: ["economy", "balanced", "full"],
    fallback: "balanced",
  },
  {
    key: "root_reasoning_cadence",
    flag: "coding-root-cadence",
    values: ["full", "milestone_only", "off"],
    fallback: "milestone_only",
  },
  {
    key: "worker_reasoning_cadence",
    flag: "coding-worker-cadence",
    values: ["full", "milestone_only", "off"],
    fallback: "full",
  },
] as const;
const cancelled = () =>
  new Error("启动已取消/答案未完成；没有创建 Workflow。请重新 /coding start 或显式提交启动答案");
async function select(ctx: ExtensionContext, title: string, values: readonly string[], current: () => void) {
  current();
  if (!ctx.hasUI)
    throw new Error(
      `启动答案缺失：${title}；非 UI 请显式提交 --coding-mode 及审计字段或 --coding-audit-defaults`,
    );
  const value = await ctx.ui.select(title, [...values]);
  current();
  if (value === undefined) throw cancelled();
  if (!values.includes(value)) throw new Error(`无效启动答案：${title}`);
  return value;
}
/** Fixed-order question registry: both command and flag adapters use this one collector. */
export const STARTUP_QUESTIONS = [
  {
    id: "mode",
    async collect(d: Draft, ctx: ExtensionContext, current: () => void) {
      if (d.mode) return;
      const choice = await select(
        ctx,
        "1. Coding 模式",
        ["multi（默认预算1）", "single", "multi（自定义数量）"],
        current,
      );
      d.mode = choice === "single" ? "single" : "multi";
      if (d.mode === "single" && d.count !== undefined) throw new Error("single 不接受子代理数量");
      if (choice === "multi（自定义数量）" && d.count === undefined) {
        current();
        const count = await ctx.ui.input("multi 子代理预算：正整数");
        current();
        if (count === undefined) throw cancelled();
        d.count = parseCount(count);
      }
    },
  },
  {
    id: "audit",
    async collect(d: Draft, ctx: ExtensionContext, current: () => void) {
      const missing = FIELDS.filter((f) => d.audit[f.key] === undefined);
      if (!missing.length) return;
      const choice = await select(
        ctx,
        "2. 审计可见性（仅安全摘要偏好，不代表日志能力）",
        ["使用默认（balanced / milestone_only / full）", "定制未提供字段"],
        current,
      );
      for (const f of missing) {
        d.audit[f.key] = choice.startsWith("使用默认")
          ? f.fallback
          : await select(ctx, f.key, f.values, current);
        d.audit.source[f.key] = choice.startsWith("使用默认") ? "default" : "explicit";
      }
    },
  },
];
function parseCount(value: string) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new Error("multi 数量必须为有效正整数；不能回退默认1");
  return Number(value);
}
export function validateAnswers(value: unknown): StartupAnswers {
  const a = value as StartupAnswers;
  if (
    !a ||
    !["single", "multi"].includes(a.mode) ||
    !Number.isSafeInteger(a.count) ||
    (a.mode === "single" ? a.count !== 0 : a.count < 1)
  )
    throw new Error("启动模式/预算快照无效");
  for (const f of FIELDS)
    if (
      !(f.values as readonly string[]).includes(a.audit?.[f.key]) ||
      !["explicit", "default"].includes(a.audit?.source?.[f.key])
    )
      throw new Error(`审计启动快照无效：${f.key}`);
  return structuredClone(a);
}
export async function collectStartup(
  ctx: ExtensionContext,
  input: StartupInput,
  saved?: StartupAnswers,
  current: () => void = () => {},
): Promise<StartupAnswers> {
  const d: Draft = saved ? structuredClone(saved) : { audit: { source: {} } };
  if (input.mode !== undefined) {
    if (input.mode !== "single" && input.mode !== "multi")
      throw new Error("--coding-mode 只接受 single/multi");
    if (saved && saved.mode !== input.mode) throw new Error("同 Session 模式已锁定；请新建 Session");
    d.mode = input.mode;
  }
  if (input.count !== undefined) {
    if (d.mode === "single") throw new Error("single 不接受子代理数量");
    d.count = parseCount(input.count);
    if (saved && d.count !== saved.count) throw new Error("同 Session 预算已锁定；扩容须显式 add-slot");
  }
  for (const f of FIELDS) {
    const value = input.audit?.[f.key];
    if (value !== undefined) {
      if (!(f.values as readonly string[]).includes(value)) throw new Error(`无效 ${f.key}`);
      if (saved && saved.audit[f.key] !== value)
        throw new Error("同 Session 审计答案已确认；不能借新任务隐式覆盖");
      if (!saved) {
        d.audit[f.key] = value;
        d.audit.source[f.key] = "explicit";
      }
    } else if (input.defaults && !saved) {
      d.audit[f.key] = f.fallback;
      d.audit.source[f.key] = "default";
    }
  }
  for (const question of STARTUP_QUESTIONS) await question.collect(d, ctx, current);
  d.count = d.mode === "single" ? 0 : (d.count ?? 1);
  return validateAnswers(d);
}
export function registerStartupFlags(pi: ExtensionAPI) {
  pi.registerFlag("coding-mode", { description: "显式启用 single 或 multi", type: "string" });
  pi.registerFlag("coding-count", { description: "multi 的正整数预算；省略为1", type: "string" });
  pi.registerFlag("coding-audit-defaults", {
    description: "明确接受缺失审计字段的默认值",
    type: "boolean",
    default: false,
  });
  for (const f of FIELDS)
    pi.registerFlag(f.flag, { description: `${f.key}: ${f.values.join(" | ")}`, type: "string" });
}
export function startupFlags(pi: ExtensionAPI): StartupInput {
  return {
    mode: pi.getFlag("coding-mode") as string | undefined,
    count: pi.getFlag("coding-count") as string | undefined,
    defaults: pi.getFlag("coding-audit-defaults") === true,
    audit: Object.fromEntries(FIELDS.map((f) => [f.key, pi.getFlag(f.flag)])),
  };
}
/** Command options are read only before the task; task text is never interpreted as flags. */
export function parseStartupCommand(input: string): { input: StartupInput; task: string } | undefined {
  const match = /^(start|single|multi)(?:\s+|$)([\s\S]*)$/.exec(input);
  if (!match) return;
  let rest = match[2].trim();
  const answer: StartupInput = { mode: match[1] === "start" ? undefined : match[1], audit: {} };
  if (match[1] !== "start" && /^[+-]?\d+(?:\.\d+)?(?:\s|$)/.test(rest)) {
    const token = rest.split(/\s/)[0];
    answer.count = token;
    rest = rest.slice(token.length).trim();
  }
  const seen = new Set<string>();
  while (rest.startsWith("--")) {
    const [flag, value] = rest.split(/\s+/, 2);
    if (flag === "--") {
      rest = rest.slice(2).trim();
      break;
    }
    if (seen.has(flag)) throw new Error(`重复启动参数 ${flag}`);
    seen.add(flag);
    if (flag === "--audit-defaults") {
      answer.defaults = true;
      rest = rest.slice(flag.length).trim();
      continue;
    }
    const f = FIELDS.find((f) => flag === `--${f.flag.slice(7)}`);
    if (!value || (!f && flag !== "--mode" && flag !== "--count")) throw new Error(`无效启动参数 ${flag}`);
    if (f) answer.audit![f.key] = value;
    else if (flag === "--mode") {
      if (answer.mode) throw new Error("重复模式");
      answer.mode = value;
    } else {
      if (answer.count !== undefined) throw new Error("重复数量");
      answer.count = value;
    }
    rest = rest.slice(flag.length).trim().slice(value.length).trim();
  }
  if (!rest || rest.length > 8000) throw new Error("启动任务必须明确且不超过8000字符");
  return { input: answer, task: rest };
}
