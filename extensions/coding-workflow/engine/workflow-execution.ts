import { randomUUID } from "node:crypto";
import { currentModule, type Catalog, type Checkpoint, type HookId } from "../catalog.ts";
import { currentCheckpoint } from "./checkpoint-progress.ts";
import {
  hasCurrentContentAndDocumentation,
  hasText,
  revokeSlice,
  ROLES,
  sameEpoch,
  type Allocation,
  type Effect,
  type Slice,
  type State,
} from "../workflow-state.ts";

const SLICE_START: Partial<Record<HookId, string>> = {
  execution: "SE02",
  delegation: "DE04",
  documentation: "DOC02",
  delivery: "DA02",
};
const SLICE_EFFECTS: Effect[] = ["read", "check", "content", "documentation", "git", "memory"];

export function exactPath(path: string): boolean {
  if (!hasText(path, 4096) || path.startsWith("/") || path.startsWith("@") || path.includes("\\")) {
    return false;
  }
  // Slice 只接受字面路径，拒绝控制字符和通配符。
  for (const character of path) {
    if (character.charCodeAt(0) < 0x20 || "*?[]{}".includes(character)) return false;
  }
  return path.split("/").every((segment) => !["", ".", "..", ".git"].includes(segment));
}

function assertSlicePosition(catalog: Catalog, state: State): void {
  const { phase, mode, execution, step, plan } = state;
  const { hook, checkpoints } = currentModule(catalog, phase, mode);
  const floor = checkpoints.findIndex((item) => item.id === SLICE_START[hook]);
  const roleReady =
    hook !== "delegation" || execution?.executor === "root" || execution?.roleConfirmed === true;
  if (floor < 0 || step < floor || !roleReady || plan === "pending") {
    throw new Error("尚未到达 Slice 放行条件或共享计划未解决");
  }
}

function assertSliceFields(slice: Slice): void {
  const { objective, returnConditions, unreleased, paths, mutations } = slice;
  if (
    ![objective, returnConditions, unreleased].every((value) => hasText(value)) ||
    !Array.isArray(paths) ||
    paths.length > 64 ||
    paths.some((path) => !exactPath(path))
  ) {
    throw new Error("Slice 四字段必须完整，路径须为精确仓库相对文件，不接受目录/通配/穿越");
  }
  if (
    !Array.isArray(mutations) ||
    !mutations.length ||
    mutations.some((effect) => !SLICE_EFFECTS.includes(effect))
  ) {
    throw new Error("Slice 影响类型无效");
  }
}

export function releaseSlice(catalog: Catalog, state: State, slice: Slice): void {
  assertSlicePosition(catalog, state);
  assertSliceFields(slice);
  revokeSlice(state);
  state.slice = structuredClone(slice);
  state.revision++;
}

interface ExecutionEffect {
  effect: Effect;
  path: string | undefined;
}

function phaseEffectBlock(catalog: Catalog, state: State, effect: Effect): string | undefined {
  if (effect === "content" && state.phase !== "execution") {
    return "内容改动只能在执行/获准修复阶段进行";
  }
  if (effect === "documentation" && !["execution", "documentation"].includes(state.phase)) {
    return "当前阶段不接受文档写入";
  }
  if (effect === "git") {
    if (state.phase !== "delivery" || currentCheckpoint(catalog, state)?.id !== SLICE_START.delivery) {
      return "Git 影响只能在单独获授权的 DA02 检查点执行";
    }
    if (!hasCurrentContentAndDocumentation(state))
      return "Git 操作依赖当前内容和文档验证，须先补齐受影响维度";
  }
  return undefined;
}

export function executionBlock(catalog: Catalog, state: State, request: ExecutionEffect): string | undefined {
  const { effect, path } = request;
  if (["read", "check", "memory"].includes(effect)) return undefined;
  if (state.status !== "active") return "路线已暂停/阻断，先取得当前证据并恢复；不要重放效果";
  const slice = state.slice;
  if (!slice?.mutations.includes(effect)) return "该影响未被当前 Slice 放行";
  const phaseBlock = phaseEffectBlock(catalog, state, effect);
  if (phaseBlock) return phaseBlock;
  if (path !== undefined && !slice.paths.includes(path)) return "路径不在本次 Slice 的精确路径集合中";
  return undefined;
}

type Reservation = Pick<Allocation, "role" | "callId">;

function canDispatch(state: State, checkpoint: Checkpoint | undefined, jobs: Reservation[]): boolean {
  if (state.mode !== "multi") return false;
  if (checkpoint?.id === "VR02") return jobs.every((job) => job.role === "Change Verification");
  const decision = state.execution;
  return (
    checkpoint?.id === "DE06" &&
    Boolean(state.slice) &&
    decision?.executor === "sub_agent" &&
    decision.roleConfirmed === true &&
    sameEpoch(decision.dispatchEpoch, state.epoch)
  );
}

export function reserveJobs(
  state: State,
  checkpoint: Checkpoint | undefined,
  jobs: Reservation[],
): Allocation[] {
  if (!canDispatch(state, checkpoint, jobs)) {
    throw new Error(
      "创建需要 Multi、具体任务授权及职责门禁；执行须完成 DE05 后在 DE06 一次创建/派发，独立只读验证须到 VR02",
    );
  }
  const roles = [...state.allocations, ...jobs].map((job) => job.role);
  if (
    !jobs.length ||
    roles.length > state.childCount ||
    roles.some((role) => !ROLES.includes(role)) ||
    new Set(roles).size !== roles.length
  ) {
    throw new Error("批准预算不足或职责重复；已创建任务的名额不能回收");
  }
  const allocations = jobs.map((job) => ({ id: randomUUID(), ...job, status: "running" as const }));
  state.allocations.push(...allocations);
  state.revision++;
  return structuredClone(allocations);
}

export function addAvailableSlot(state: State, role: string): void {
  const unusedRole =
    ROLES.some((available) => available === role) && !state.allocations.some((slot) => slot.role === role);
  if (state.mode !== "multi" || !unusedRole || state.allocations.length < state.childCount) {
    throw new Error("只能为尚未占用的不同职责，在没有未用名额时明确增加一个名额");
  }
  state.childCount++;
  state.revision++;
}
