import assert from 'node:assert/strict';
import { currentModule, loadCatalog } from '../extensions/coding-workflow/catalog.ts';
import { installWorkflow } from '../extensions/coding-workflow/runtime.ts';

export const catalog = loadCatalog();

export const subSchema = {
  type: 'object',
  properties: {
    agent: { type: 'string' },
    task: { type: 'string' },
    cwd: { type: 'string' },
  },
  required: ['agent', 'task'],
};

export const callsSchema = {
  type: 'object',
  properties: {
    calls: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          agent: { type: 'string' },
          prompt: { type: 'string' },
          cwd: { type: 'string' },
          initialContext: { type: 'string', enum: ['empty', 'parent'] },
          model: { type: 'string' },
          thinking: { type: 'string', enum: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] },
          session: { type: 'string' },
        },
        required: ['agent', 'prompt'],
      },
    },
  },
  required: ['calls'],
};

export function body(text) {
  return { content: [{ type: 'text', text }], details: {} };
}

export function harness(options = {}) {
  const handlers = new Map();
  const definitions = new Map();
  const commands = new Map();
  const entries = structuredClone(options.entries ?? []);
  const messages = [];
  const calls = [];
  const flags = options.flags ?? {};
  let branch;
  let sessionId = 'runtime-test';
  let nextId = 0;
  const raw = new Map([
    ['read', { parameters: {}, execute: async () => body('actual synthetic readback') }],
    ['write', { parameters: {}, execute: async () => body('synthetic write result') }],
    ['bash', { parameters: {}, execute: async () => body('synthetic command result') }],
    [
      'subagent',
      {
        parameters: structuredClone(subSchema),
        execute: async () => body('actual synthetic task result with paths/checks/failures'),
      },
    ],
  ]);

  const pi = {
    on(name, handler) {
      const listeners = handlers.get(name) ?? [];
      listeners.push(handler);
      handlers.set(name, listeners);
    },
    registerFlag() {},
    getFlag: (name) => flags[name],
    registerTool: (definition) => definitions.set(definition.name, definition),
    registerCommand: (name, definition) => commands.set(name, definition),
    appendEntry(customType, data) {
      entries.push({ id: `entry-${++nextId}`, type: 'custom', customType, data: structuredClone(data) });
    },
    sendMessage: (message, opts) => messages.push({ message, opts }),
    getAllTools: () =>
      [...raw].map(([name, spec]) => ({
        name,
        parameters: spec.parameters,
        annotations: spec.annotations,
      })),
  };
  const ctx = {
    cwd: process.cwd(),
    hasUI: options.hasUI ?? false,
    ui: { select: options.select, input: options.input, notify() {}, setStatus() {} },
    sessionManager: {
      getSessionId: () => sessionId,
      getEntries: () => entries,
      getBranch: () => branch ?? entries,
    },
  };
  // Schema 校验由真实 Pi 的入口 smoke 覆盖，这里只模拟宿主事件及实际调用结果。
  const installed = installWorkflow(
    pi,
    { checkpoint: {}, slice: {}, run: {}, delegate: {} },
    options.catalog ?? catalog,
  );

  async function emit(name, event = {}) {
    let output;
    for (const handler of handlers.get(name) ?? []) {
      output = (await handler({ type: name, ...event }, ctx)) ?? output;
    }
    return output;
  }

  async function executeCall(call) {
    const { id, name, input } = call;
    try {
      const definition = definitions.get(name) ?? raw.get(name);
      if (!definition) throw new Error('Unknown tool');
      calls.push(call);
      let nestedCalls = 0;
      const tools = [...raw].filter(([, spec]) => !spec.hidden).map(([name, spec]) => ({ ...spec, name }));
      const toolContext = {
        ...ctx,
        tools,
        executeTool: (target, args) =>
          invoke(target, args, { id: `${id}/${++nestedCalls}`, parentToolCallId: id }),
      };
      const result = await definition.execute(id, input, undefined, undefined, toolContext);
      return { result, isError: result.isError === true, durationMs: 1 };
    } catch (error) {
      return { result: body(String(error)), isError: true, durationMs: 1 };
    }
  }

  async function invoke(name, input, { id = `call-${++nextId}`, parentToolCallId } = {}) {
    const event = { toolName: name, toolCallId: id, parentToolCallId };
    const decision = await emit('tool_call', { ...event, input });
    // 被 Hook 阻止的调用不带运行时长，扩展据此区分失败与实际未运行。
    const outcome = decision?.block
      ? { result: body(decision.reason), isError: true, durationMs: undefined }
      : await executeCall({ name, input, id, parentToolCallId });
    await emit('tool_execution_end', { ...event, ...outcome });
    return { toolCall: { id, name, arguments: input }, ...outcome };
  }

  const w = installed.getWorkflow;
  const userRef = () => w().state.observations.find((observation) => observation.effect === 'user').id;
  function run(tool = 'bash', effect = 'read', input = {}) {
    return invoke('coding_run', {
      revision: w().state.revision,
      tool,
      input,
      effect,
      rationale: '合成测试中已明确该实际调用的影响范围',
      evidence: [userRef()],
    });
  }
  async function start(args = 'single 合成任务，用户明确禁止持久化计划') {
    const command = args.replace(/^(single|multi)(\s+\d+)?\s+/, '$1$2 --audit-defaults ');
    await commands.get('coding').handler(command, ctx);
    assert.ok(w(), messages.at(-1)?.message.content);
  }

  return {
    ...installed,
    pi,
    raw,
    definitions,
    ctx,
    entries,
    messages,
    calls,
    emit,
    invoke,
    start,
    run,
    w,
    userRef,
    commands,
    setBranch(value) {
      branch = value;
    },
    setSessionId(value) {
      sessionId = value;
    },
  };
}

export function atCheckpoint(host, { phase, checkpoint, withSlice = false }) {
  const { state, catalog } = host.w();
  const module = currentModule(catalog, phase, state.mode);
  const step = module.checkpoints.findIndex((item) => item.id === checkpoint);
  assert.ok(step >= 0, `fixture 缺少检查点 ${phase}/${checkpoint}`);

  // 各集成用例从所需边界开始，宿主事件仍执行真实的守卫和证据记录。
  state.phase = phase;
  state.step = step;
  state.plan = 'prohibited';
  if (withSlice) {
    state.slice = {
      objective: 'synthetic scoped task',
      paths: ['synthetic.ts'],
      mutations: ['content', 'documentation'],
      returnConditions: 'return evidence',
      unreleased: 'Git/network',
      evidence: [host.userRef()],
    };
  }
  if (checkpoint === 'DE06') {
    state.execution = {
      executor: 'sub_agent',
      roleConfirmed: true,
      dispatchEpoch: structuredClone(state.epoch),
    };
  }
}
