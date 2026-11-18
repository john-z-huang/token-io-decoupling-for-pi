import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { ROLES } from "./engine.ts";
import { SIGNALS } from "./catalog.ts";
import { installWorkflow } from "./runtime.ts";

const string = (maxLength = 2000) => Type.String({ minLength: 1, maxLength });
const evidence = Type.Array(string(), { minItems: 1, maxItems: 16 });
const enumeration = <T extends string>(values: readonly T[]) => Type.Union(values.map(v => Type.Literal(v)));
const effect = enumeration(["read", "check", "content", "documentation", "git", "memory"] as const);
const revision = Type.Integer({ minimum: 0 });
const report = Type.Object({
  checkpoint: string(16), outcome: enumeration(["complete", "not_applicable", "needs_prerequisite", "blocked"] as const),
  summary: string(), evidence, facts: Type.Optional(Type.Record(Type.String(), Type.String({ maxLength: 4000 }))),
}, { additionalProperties: false });
const slice = Type.Object({
  objective: string(), paths: Type.Array(string(4096), { maxItems: 64 }), mutations: Type.Array(effect, { minItems: 1, maxItems: 6 }),
  returnConditions: string(), unreleased: string(), evidence,
}, { additionalProperties: false });
export default function codingWorkflow(pi: ExtensionAPI): void {
  installWorkflow(pi, {
    checkpoint: Type.Union([
      Type.Object({ action: Type.Literal("status"), offset: Type.Optional(Type.Integer({ minimum: 0, maximum: 127 })) }, { additionalProperties: false }),
      Type.Object({ action: Type.Literal("rules"), document: Type.Optional(string(96)), fragment: Type.Optional(string(96)) }, { additionalProperties: false }),
      Type.Object({ action: Type.Literal("result"), resultId: string(), offset: Type.Optional(Type.Integer({ minimum: 0 })) }, { additionalProperties: false }),
      Type.Object({ action: Type.Literal("report"), revision, reports: Type.Array(report, { minItems: 1, maxItems: 10 }) }, { additionalProperties: false }),
      Type.Object({ action: Type.Literal("signal"), revision, signal: enumeration(SIGNALS), evidence, reason: string() }, { additionalProperties: false }),
      Type.Object({ action: Type.Literal("pause"), revision, reason: string() }, { additionalProperties: false }),
      Type.Object({ action: Type.Literal("resume"), revision, evidence }, { additionalProperties: false }),
      Type.Object({ action: Type.Literal("resolve_effect"), revision, callId: string(), evidence }, { additionalProperties: false }),
    ]),
    slice: Type.Object({ revision, slice }, { additionalProperties: false }),
    run: Type.Object({ revision, tool: string(), input: Type.Record(Type.String(), Type.Unknown()), effect, rationale: string(), evidence }, { additionalProperties: false }),
    delegate: Type.Object({ revision, tool: string(), evidence, jobs: Type.Array(Type.Object({
      role: enumeration(ROLES), agent: string(128), task: string(8000), paths: Type.Array(string(4096), { maxItems: 64 }),
      model: Type.Optional(Type.String({ minLength: 5, maxLength: 256, description: "Root按任务与模型卡选择精确provider/model:thinking；Sol复杂编码，Terra视觉/文字，Luna聚焦高吞吐。推理档位按任务选择，不按角色固定。" })),
      modelReason: Type.Optional(string()),
    }, { additionalProperties: false }), { minItems: 1, maxItems: 4 }) }, { additionalProperties: false }),
  });
}
