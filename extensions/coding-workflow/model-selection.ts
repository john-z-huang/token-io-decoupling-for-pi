/** Pure dispatch helpers. A request is configuration intent, never model identity attestation. */
export const CHILD_MODELS = ["gpt-6.1-sol", "gpt-6.1-terra", "gpt-6-luna"] as const;
export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type ChildThinking = (typeof THINKING_LEVELS)[number];
export function parseModelSelection(value: string): {
  provider: string;
  id: string;
  thinking: ChildThinking;
} {
  const match = /^([\w.-]+)\/([\w./-]+):(off|minimal|low|medium|high|xhigh|max)$/.exec(value);
  if (!match || match[2].split("/").some((part) => !part || part === "." || part === ".."))
    throw new Error("模型选择必须是精确 provider/model:thinking，不接受模糊匹配、通配符或凭据");
  return { provider: match[1], id: match[2], thinking: match[3] as ChildThinking };
}
export function validateChildSelection(value: string): void {
  const { id, thinking } = parseModelSelection(value);
  const family = id.split("/").at(-1)!;
  if (!CHILD_MODELS.some((name) => name === family))
    throw new Error("子任务须由 Root 从 Sol、Terra、Luna 选择实际可用模型");
  if (thinking === "minimal" || (family === "gpt-6.1-sol" && thinking === "off"))
    throw new Error("模型卡不支持该推理档位；不得默默钳制或换模型");
}
export function dispatchModelArgs(
  request: string | undefined,
  profile: string | undefined,
  defaults: { model?: string; thinkingLevel?: string },
): { model: string | undefined; args: string[] } {
  if (request !== undefined) parseModelSelection(request);
  const model = request ?? profile ?? defaults.model;
  const args = model ? ["--model", model] : [];
  // An explicit request (including its suffix) wins over profile and parent settings.
  if (request === undefined && !profile && defaults.thinkingLevel)
    args.push("--thinking", defaults.thinkingLevel);
  return { model, args };
}
