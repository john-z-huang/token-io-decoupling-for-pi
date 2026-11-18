/** 选型参数只表达配置意图，实际模型身份仍由宿主证据核验。 */
export const CHILD_MODELS = ["gpt-6.1-sol", "gpt-6.1-terra", "gpt-6-luna"] as const;
export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type ChildThinking = (typeof THINKING_LEVELS)[number];
export function parseModelSelection(value: string): {
  provider: string;
  id: string;
  thinking: ChildThinking;
} {
  const match = /^([\w.-]+)\/([\w./-]+):(\w+)$/.exec(value);
  const [, provider, id, requestedThinking] = match ?? [];
  const thinking = THINKING_LEVELS.find((level) => level === requestedThinking);
  if (!provider || !id || !thinking || id.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("模型选择必须是精确 provider/model:thinking，不接受模糊匹配、通配符或凭据");
  }
  return { provider, id, thinking };
}
export function validateChildSelection(value: string): void {
  const { id, thinking } = parseModelSelection(value);
  const family = id.slice(id.lastIndexOf("/") + 1);
  // 已登记的模型卡仅限制对应模型。其余精确模型交给实际宿主能力核验。
  if (!CHILD_MODELS.some((name) => name === family)) return;
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
  // 显式请求中的推理档位随模型参数传递，覆盖配置和父级默认值。
  if (request === undefined && !profile && defaults.thinkingLevel)
    args.push("--thinking", defaults.thinkingLevel);
  return { model, args };
}
