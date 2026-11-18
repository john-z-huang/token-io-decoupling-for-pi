import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCatalog } from '../extensions/coding-workflow/catalog.ts';
import { MAX_CONTEXT, installWorkflow, scopedPath, compatibleSubagent } from '../extensions/coding-workflow/runtime.ts';
const catalog = loadCatalog();
const subSchema = { type: 'object', properties: { agent: { type: 'string' }, task: { type: 'string' }, cwd: { type: 'string' } }, required: ['agent', 'task'] };
const callsSchema = { type: 'object', properties: { calls: { type: 'array', minItems: 1, maxItems: 8, items: {
  type: 'object', properties: { agent: { type: 'string' }, prompt: { type: 'string' }, cwd: { type: 'string' },
    initialContext: { type: 'string', enum: ['empty', 'parent'] }, model: { type: 'string' },
    thinking: { type: 'string', enum: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] }, session: { type: 'string' } },
  required: ['agent', 'prompt'],
} } }, required: ['calls'] };
const body = value => ({ content: [{ type: 'text', text: value }], details: {} });
function harness(options = {}) {
  const handlers = new Map(), definitions = new Map(), commands = new Map(), entries = structuredClone(options.entries ?? []), messages = [], calls = [];
  let branch, sessionId = 'runtime-test', next = 0;
  const flags = options.flags ?? {};
  const raw = new Map([
    ['read', { parameters: {}, execute: async () => body('actual synthetic readback') }],
    ['write', { parameters: {}, execute: async () => body('synthetic write result') }],
    ['bash', { parameters: {}, execute: async () => body('synthetic command result') }],
    ['subagent', { parameters: subSchema, execute: async () => body('actual synthetic task result with paths/checks/failures') }],
  ]);
  const pi = {
    on(name, fn) { const list = handlers.get(name) ?? []; list.push(fn); handlers.set(name, list); },
    registerFlag() {}, getFlag: name => flags[name], registerTool: def => definitions.set(def.name, def),
    registerCommand: (name, def) => commands.set(name, def),
    appendEntry(customType, data) { entries.push({ id: `entry-${++next}`, type: 'custom', customType, data: structuredClone(data) }); },
    sendMessage: (message, opts) => messages.push({ message, opts }),
    getAllTools: () => [...raw].map(([name, spec]) => ({ name, parameters: spec.parameters, annotations: spec.annotations })),
  };
  const ctx = { cwd: process.cwd(), hasUI: options.hasUI ?? false, ui: { select: options.select, input: options.input, notify: () => {}, setStatus: () => {} }, sessionManager: { getSessionId: () => sessionId, getEntries: () => entries, getBranch: () => branch ?? entries } };
  const installed = installWorkflow(pi, { checkpoint: {}, slice: {}, run: {}, delegate: {} }, catalog);
  async function emit(name, event = {}) { let output; for (const fn of handlers.get(name) ?? []) output = await fn({ type: name, ...event }, ctx) ?? output; return output; }
  async function invoke(name, input, id = `call-${++next}`, parentToolCallId) {
    const decision = await emit('tool_call', { toolName: name, input, toolCallId: id, parentToolCallId });
    let result, isError = !!decision?.block, durationMs;
    if (isError) result = body(decision.reason);
    else {
      try {
        const def = definitions.get(name) ?? raw.get(name);
        if (!def) throw new Error('Unknown tool');
        calls.push({ name, input, id, parentToolCallId });
        let n = 0;
        const toolCtx = { ...ctx, tools: [...raw].filter(([, spec]) => !spec.hidden).map(([name, spec]) => ({ ...spec, name })), executeTool: (target, args) => invoke(target, args, `${id}/${++n}`, id) };
        result = await def.execute(id, input, undefined, undefined, toolCtx); isError = result.isError === true; durationMs = 1;
      } catch (error) { result = body(String(error)); isError = true; durationMs = 1; }
    }
    await emit('tool_execution_end', { toolCallId: id, toolName: name, result, isError, durationMs, parentToolCallId });
    return { toolCall: { id, name, arguments: input }, result, isError, durationMs };
  }
  const w = () => installed.getWorkflow();
  const userRef = () => w().state.observations.find(o => o.effect === 'user').id;
  const run = (tool = 'bash', effect = 'read', input = {}) => invoke('coding_run', { revision: w().state.revision, tool, input, effect, rationale: '合成测试中已明确该实际调用的影响范围', evidence: [userRef()] });
  async function start(args = 'single 合成任务，用户明确禁止持久化计划') { await commands.get('coding').handler(args.replace(/^(single|multi)(\s+\d+)?\s+/, '$1$2 --audit-defaults '), ctx); assert.ok(w(), messages.at(-1)?.message.content); }
  return { ...installed, pi, raw, definitions, ctx, entries, messages, calls, emit, invoke, start, run, w, userRef, commands,
    setBranch(value) { branch = value; }, setSessionId(value) { sessionId = value; } };
}
for (const model of ['gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-luna']) test(`Root model choice is forwarded through actual declared schema: ${model}`, async () => {
  const h = harness(); await h.start('multi 合成模型选择'); position(h, 'execution', 6, true);
  h.raw.get('subagent').parameters = { ...subSchema, properties: { ...subSchema.properties, model: { type: 'string' } } };
  const selected = `openai/${model}:medium`;
  const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [{ role: 'Primary Output', agent: 'worker', task: 'bounded synthetic task', paths: [], model: selected, modelReason: 'Root按本任务的复杂度与可验证性选择，而非按角色固定' }] });
  assert.equal(result.isError, false);
  assert.equal(h.calls.find(c => c.name === 'subagent').input.model, selected);
  assert.equal(h.w().state.allocations.length, 1);
});
test('explicit selection cannot silently degrade on an older subagent schema', async () => {
  const h = harness(); await h.start('multi 合成旧接口'); position(h, 'execution', 6, true);
  const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [{ role: 'Primary Output', agent: 'worker', task: 'synthetic', paths: [], model: 'openai/gpt-6-luna:low', modelReason: 'bounded' }] });
  assert.equal(result.isError, true); assert.equal(h.w().state.allocations.length, 0);
  assert.equal(h.calls.filter(c => c.name === 'subagent').length, 0);
});
test('invalid model or missing Root rationale rejects all jobs before reserving or calling', async () => {
  for (const choice of [
    { model: 'openai/gpt-6.1-sol:off', modelReason: 'bad level' },
    { model: 'openai/gpt-other:medium', modelReason: 'not in requested family' },
    { model: 'openai/gpt-6-luna:medium' },
    { modelReason: 'no actual selection' },
  ]) {
    const h = harness(); await h.start('multi 2 合成原子前检'); position(h, 'execution', 6, true);
    h.raw.get('subagent').parameters = { ...subSchema, properties: { ...subSchema.properties, model: { type: 'string' } } };
    const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [
      { role: 'Primary Output', agent: 'worker', task: 'first valid synthetic', paths: [], model: 'openai/gpt-6-luna:low', modelReason: 'bounded' },
      { role: 'Context Bootstrap/Refresh', agent: 'scout', task: 'later invalid synthetic', paths: [], ...choice },
    ] });
    assert.equal(result.isError, true); assert.equal(h.w().state.allocations.length, 0);
    assert.equal(h.calls.filter(c => c.name === 'subagent').length, 0);
  }
});
test('model selection does not enable an unsupported Git role', async () => {
  const h = harness(); await h.start('multi 合成Git角色'); position(h, 'execution', 6, true);
  h.raw.get('subagent').parameters = { ...subSchema, properties: { ...subSchema.properties, model: { type: 'string' } } };
  const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [{ role: 'Documentation/Comments & Git Operations', agent: 'git-operator', task: 'synthetic', paths: [], model: 'openai/gpt-6.1-sol:high', modelReason: 'cannot create missing adapter' }] });
  assert.equal(result.isError, true); assert.equal(h.w().state.allocations.length, 0);
});
function position(h, phase, step, slice = false) {
  const s = h.w().state; s.phase = phase; s.step = step; s.plan = 'prohibited';
  if (slice) s.slice = { objective: 'synthetic scoped task', paths: ['synthetic.ts'], mutations: ['content', 'documentation'], returnConditions: 'return evidence', unreleased: 'Git/network', evidence: [h.userRef()] };
  if (phase === 'execution' && s.mode === 'multi' && step === 6) {
    s.execution = { executor: 'sub_agent', roleConfirmed: true, dispatchEpoch: structuredClone(s.epoch) };
  }
}

test('package declares one extension and excludes local Serena metadata by a narrow files allowlist', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.pi.extensions, ['./extensions/coding-workflow/index.ts']);
  assert.deepEqual(manifest.files, ['extensions/coding-workflow/*.ts', 'docs/skill', 'agents/*.md', 'integrations/pi-subagent/*', 'README.md']);
  assert.equal(manifest.peerDependencies.typebox, '*');
});
test('extension is passive before explicit opt-in and does not write configuration or state', async () => {
  const h = harness(); assert.equal(h.isEnabled(), false);
  const messages = [{ role: 'user', content: 'hello' }]; assert.deepEqual((await h.emit('context', { messages })).messages, messages);
  assert.equal((await h.invoke('bash', {})).isError, false); assert.equal(h.entries.length, 0);
});
test('command explicitly selects mode/count without creating a child', async () => {
  const h = harness(); await h.start('multi 2 合成任务');
  assert.equal(h.w().state.mode, 'multi'); assert.equal(h.w().state.childCount, 2); assert.equal(h.calls.length, 0);
  assert.equal(h.messages.at(-1).opts.triggerTurn, true);
});
test('CLI flags start only from actual user input, preserving other system prompt sections', async () => {
  const h = harness({ flags: { 'coding-mode': 'single', 'coding-audit-defaults': true } });
  await h.emit('before_agent_start', { messageType: 'custom', systemPromptOptions: { sections: {} } }); assert.equal(h.w(), undefined);
  const options = { sections: { existing: 'keep' } };
  await h.emit('before_agent_start', { messageType: 'user', prompt: '真实合成用户目标', systemPromptOptions: options });
  assert.equal(h.w().state.task, '真实合成用户目标'); assert.equal(options.sections.existing, 'keep'); assert.ok(options.sections.coding_workflow);
});
test('context injects only relevant hooks once and preserves unrelated extension messages', async () => {
  const h = harness(); await h.start();
  const other = { role: 'custom', customType: 'other-extension', content: 'keep' };
  const first = await h.emit('context', { messages: [other] }); const second = await h.emit('context', { messages: first.messages });
  assert.equal(second.messages.length, 2); assert.equal(second.messages[0], other);
  assert.match(second.messages[1].content, /Hook:entry/); assert.doesNotMatch(second.messages[1].content, /Hook:materialization/);
  assert.ok(second.messages[1].content.length < MAX_CONTEXT);
});
test('unknown direct shell and lying readOnlyHint do not pass the wrapper gate', async () => {
  const h = harness(); await h.start();
  assert.equal((await h.invoke('bash', {})).isError, true);
  h.raw.set('opaque_mcp', { parameters: {}, annotations: { readOnlyHint: true }, execute: async () => body('not a security proof') });
  assert.equal((await h.invoke('opaque_mcp', {})).isError, true);
});
test('coding_run calls actual exposed target through host hooks and captures real evidence', async () => {
  const h = harness(); await h.start(); const out = await h.run();
  assert.equal(out.isError, false); assert.ok(h.calls.some(c => c.name === 'bash' && c.parentToolCallId));
  assert.ok(h.w().state.observations.some(o => o.tool === 'bash' && o.ok)); assert.equal(h.w().state.inFlight.length, 0);
});
test('wrapper cannot call hidden/unknown/internal/recursive or subagent tools', async () => {
  const h = harness(); await h.start();
  h.raw.set('hidden', { hidden: true, parameters: {}, execute: async () => body('must not run') });
  for (const target of ['hidden', 'missing', 'coding_run', 'coding_checkpoint', 'subagent']) assert.equal((await h.run(target)).isError, true, target);
  assert.equal(h.w().state.allocations.length, 0);
});
test('opaque content mutation is blocked before Slice release', async () => {
  const h = harness(); await h.start(); assert.equal((await h.run('bash', 'content')).isError, true);
  assert.equal(h.calls.filter(c => c.name === 'bash').length, 0);
});
test('built-in writes enforce the exact released path and invalidate the correct epoch', async () => {
  const h = harness(); await h.start();
  assert.equal((await h.invoke('write', { path: 'synthetic.ts' })).isError, true);
  position(h, 'execution', 3, true);
  assert.equal((await h.invoke('write', { path: 'other.ts' })).isError, true);
  assert.equal((await h.invoke('write', { path: 'synthetic.ts' })).isError, false);
  assert.equal(h.w().state.epoch.content, 1); assert.deepEqual(h.w().state.inFlight, []);
});
test('failed writes may partially mutate and invalidate; blocked calls do not', async () => {
  const h = harness(); await h.start(); position(h, 'execution', 3, true);
  h.raw.get('write').execute = async () => { throw new Error('partial write failure'); };
  assert.equal((await h.invoke('write', { path: 'synthetic.ts' })).isError, true); assert.equal(h.w().state.epoch.content, 1);
  assert.equal((await h.invoke('write', { path: 'other.ts' })).isError, true); assert.equal(h.w().state.epoch.content, 1);
  h.pi.on('tool_call', event => event.toolName === 'bash' ? { block: true, reason: 'synthetic host denial before execute' } : undefined);
  assert.equal((await h.run('bash', 'content')).isError, true); assert.equal(h.w().state.epoch.content, 1);
});
test('nested writes cannot bypass exact-path gates inside a read-classified orchestrator', async () => {
  const h = harness(); await h.start(); position(h, 'execution', 3, true);
  h.raw.set('orchestrator', { parameters: {}, execute: async (_id, _p, _s, _u, ctx) => (await ctx.executeTool('write', { path: 'escape.ts' })).result });
  await h.run('orchestrator'); assert.equal(h.w().state.epoch.content, 0); assert.equal(h.calls.filter(c => c.name === 'write').length, 0);
});
test('real delegate adapter performs one synchronous call and records no fabricated child Session ID', async () => {
  const h = harness(); await h.start('multi 合成实现任务'); position(h, 'execution', 6, true);
  const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [{ role: 'Primary Output', agent: 'worker', task: '执行已放行的合成任务', paths: [] }] });
  assert.equal(result.isError, false); assert.equal(h.calls.filter(c => c.name === 'subagent').length, 1);
  assert.equal(h.w().state.allocations[0].status, 'completed'); assert.equal('sessionId' in h.w().state.allocations[0], false);
  assert.match(h.calls.find(c => c.name === 'subagent').input.task, /禁止创建\/派发其他代理/);
});
test('delegate rejects a write path when the current Slice does not allow its effect', async () => {
  const h = harness(); await h.start('multi 合成只读切片'); position(h, 'execution', 6, true);
  h.w().state.slice.mutations = ['read'];
  const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [{ role: 'Primary Output', agent: 'worker', task: 'synthetic', paths: ['synthetic.ts'] }] });
  assert.match(result.result.content[0].text, /影响未被当前 Slice 放行/);
  assert.equal(h.calls.filter(c => c.name === 'subagent').length, 0);
  assert.equal(h.w().state.allocations.length, 0);
});
test('calls[] adapter maps prompt and explicit thinking without creating a named session', async () => {
  const h = harness(); await h.start('multi 合成3.1接口'); position(h, 'execution', 6, true);
  h.raw.get('subagent').parameters = callsSchema;
  const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [
    { role: 'Primary Output', agent: 'worker', task: '执行新版合成任务', paths: [], model: 'openai/gpt-6.1-sol:medium', modelReason: '显式选择不可被代理默认high覆盖' },
  ] });
  assert.equal(result.isError, false, JSON.stringify(result));
  const calls = h.calls.filter(c => c.name === 'subagent'); assert.equal(calls.length, 1);
  assert.ok(calls[0].parentToolCallId);
  const input = calls[0].input; assert.deepEqual(Object.keys(input), ['calls']); assert.equal(input.calls.length, 1);
  const [call] = input.calls;
  assert.equal(call.agent, 'worker'); assert.equal(call.cwd, process.cwd()); assert.equal(call.initialContext, 'empty');
  assert.equal(call.model, 'openai/gpt-6.1-sol'); assert.equal(call.thinking, 'medium');
  assert.match(call.prompt, /执行新版合成任务/); assert.match(call.prompt, /禁止创建\/派发其他代理/);
  assert.equal('task' in call, false); assert.equal('session' in call, false);
  assert.equal(h.w().state.allocations[0].status, 'completed'); assert.equal('sessionId' in h.w().state.allocations[0], false);
});
test('calls[] adapter preserves default model inheritance when no selection was requested', async () => {
  const h = harness(); await h.start('multi 合成继承'); position(h, 'execution', 6, true);
  h.raw.get('subagent').parameters = callsSchema;
  const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [
    { role: 'Primary Output', agent: 'worker', task: 'inherit', paths: [] },
  ] });
  assert.equal(result.isError, false);
  const [call] = h.calls.find(c => c.name === 'subagent').input.calls;
  assert.equal('model' in call, false); assert.equal('thinking' in call, false); assert.equal('session' in call, false);
});
test('calls[] preflight rejects unsupported model/thinking before any reservation or execution', async () => {
  for (const missing of ['model', 'thinking', 'unsupported-medium']) {
    const h = harness(); await h.start('multi 2 合成新版前检'); position(h, 'execution', 6, true);
    const schema = structuredClone(callsSchema), fields = schema.properties.calls.items.properties;
    if (missing === 'unsupported-medium') fields.thinking.enum = ['low']; else delete fields[missing];
    h.raw.get('subagent').parameters = schema;
    const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [
      { role: 'Primary Output', agent: 'worker', task: 'valid first', paths: [] },
      { role: 'Context Bootstrap/Refresh', agent: 'scout', task: 'unsupported later selection', paths: [], model: 'openai/gpt-6-luna:medium', modelReason: 'bounded' },
    ] });
    assert.equal(result.isError, true); assert.equal(h.w().state.allocations.length, 0);
    assert.equal(h.calls.filter(c => c.name === 'subagent').length, 0);
  }
});
test('calls[] jobs remain separate host calls; child failure retains occupied budgets', async () => {
  const h = harness(); await h.start('multi 2 合成新版失败'); position(h, 'execution', 6, true);
  h.raw.get('subagent').parameters = callsSchema;
  h.raw.get('subagent').execute = async (_id, input) => ({ ...body('实际失败与部分结果'), isError: input.calls[0].agent === 'scout' });
  const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [
    { role: 'Primary Output', agent: 'worker', task: 'first', paths: [] },
    { role: 'Context Bootstrap/Refresh', agent: 'scout', task: 'second', paths: [] },
  ] });
  assert.equal(result.isError, true); assert.equal(h.calls.filter(c => c.name === 'subagent').length, 2);
  assert.deepEqual(h.w().state.allocations.map(a => a.status), ['completed', 'failed']);
  assert.equal(h.w().state.allocations.length, 2);
});
test('calls[] Schema cannot bypass direct-call and coding_run delegation guards', async () => {
  const h = harness(); await h.start('multi 合成旁路'); position(h, 'execution', 6, true);
  h.raw.get('subagent').parameters = callsSchema;
  const input = { calls: [{ agent: 'worker', prompt: 'must not run' }] };
  assert.equal((await h.invoke('subagent', input)).isError, true);
  assert.equal((await h.run('subagent', 'read', input)).isError, true);
  assert.equal(h.calls.filter(c => c.name === 'subagent').length, 0); assert.equal(h.w().state.allocations.length, 0);
});
test('calls[] recognition rejects unsupported required fields and incompatible array/context shapes', () => {
  assert.equal(compatibleSubagent(callsSchema), true);
  for (const change of [
    s => s.required.push('unsupported'),
    s => s.properties.calls.items.required.push('session'),
    s => s.properties.calls.items.required.push('unsupported'),
    s => { s.properties.calls.type = 'string'; },
    s => { s.properties.calls.minItems = 2; },
    s => { s.properties.calls.maxItems = 0; },
    s => { s.properties.calls.items.properties.prompt.type = 'number'; },
    s => { delete s.properties.calls.items.properties.cwd; },
    s => { delete s.properties.calls.items.properties.initialContext; },
    s => { s.properties.calls.items.properties.initialContext.enum = ['parent']; },
  ]) {
    const schema = structuredClone(callsSchema); change(schema); assert.equal(compatibleSubagent(schema), false, JSON.stringify(schema));
  }
});
test('calls[] incompatible required fields fail before reserving even when a prior job is valid', async () => {
  const h = harness(); await h.start('multi 2 合成未知必需字段'); position(h, 'execution', 6, true);
  const schema = structuredClone(callsSchema); schema.properties.calls.items.required.push('session');
  h.raw.get('subagent').parameters = schema;
  const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [
    { role: 'Primary Output', agent: 'worker', task: 'first', paths: [] },
    { role: 'Context Bootstrap/Refresh', agent: 'scout', task: 'second', paths: [] },
  ] });
  assert.equal(result.isError, true); assert.equal(h.w().state.allocations.length, 0);
  assert.equal(h.calls.filter(c => c.name === 'subagent').length, 0);
});
test('calls[] still rejects single mode, Git roles, duplicate roles and conflicting paths', async () => {
  for (const scenario of ['single', 'git', 'duplicate', 'paths']) {
    const h = harness(); await h.start(scenario === 'single' ? 'single 合成禁止委派' : 'multi 2 合成新版门禁'); position(h, 'execution', 6, true);
    h.raw.get('subagent').parameters = callsSchema;
    const first = { role: 'Primary Output', agent: 'worker', task: 'first', paths: [] };
    const jobs = scenario === 'git' ? [{ ...first, role: 'Documentation/Comments & Git Operations' }]
      : scenario === 'duplicate' ? [first, { ...first, task: 'duplicate' }]
      : scenario === 'paths' ? [{ ...first, paths: ['synthetic.ts', 'synthetic.ts'] }] : [first];
    const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs });
    assert.equal(result.isError, true, scenario); assert.equal(h.w().state.allocations.length, 0);
    assert.equal(h.calls.filter(c => c.name === 'subagent').length, 0);
  }
});
test('calls[] preserves the independent read-only verification boundary and current epoch evidence', async () => {
  const h = harness(); await h.start('multi 合成新版验证'); position(h, 'verification', 2);
  h.raw.get('subagent').parameters = callsSchema;
  const job = { role: 'Change Verification', agent: 'reviewer', task: 'verify actual evidence', paths: [] };
  const blocked = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [{ ...job, paths: ['synthetic.ts'] }] });
  assert.equal(blocked.isError, true); assert.equal(h.w().state.allocations.length, 0);
  const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [job] });
  assert.equal(result.isError, false);
  assert.match(h.calls.find(c => c.name === 'subagent').input.calls[0].prompt, /只读，不准写项目文件/);
  const evidence = h.w().state.observations.find(o => o.effect === 'check'); assert.ok(evidence?.ok);
  assert.deepEqual(evidence.epoch, h.w().state.epoch);
});
test('direct subagent, single mode and incompatible Schema fail without allocating', async () => {
  const h = harness(); await h.start(); position(h, 'execution', 6, true);
  assert.equal((await h.invoke('subagent', { agent: 'worker', task: 'forbidden', cwd: process.cwd() })).isError, true);
  const args = { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [{ role: 'Primary Output', agent: 'worker', task: 'test', paths: [] }] };
  assert.equal((await h.invoke('coding_delegate', args)).isError, true); assert.equal(h.w().state.allocations.length, 0);
  assert.equal(compatibleSubagent({ properties: { task: { type: 'string' } } }), false);
  assert.equal(compatibleSubagent({ ...subSchema, required: ['agent', 'task', 'unsupported'] }), false);
});
test('parallel delegate preflight rejects budget overflow and conflicting writes before any task', async () => {
  const h = harness(); await h.start('multi 合成实现任务'); position(h, 'execution', 6, true);
  const jobs = [{ role: 'Primary Output', agent: 'worker', task: 'test', paths: [] }, { role: 'Context Bootstrap/Refresh', agent: 'worker', task: 'test', paths: [] }];
  const result = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs });
  assert.equal(result.isError, true); assert.equal(h.w().state.allocations.length, 0); assert.equal(h.calls.filter(c => c.name === 'subagent').length, 0);
});
test('stop, user input, compaction and user shell revoke Slice instead of claiming completion', async () => {
  for (const [event, payload] of [['agent_settled', { aborted: true }], ['input', { source: 'rpc', text: 'new requirement' }], ['session_compact', {}], ['user_bash', {}]]) {
    const h = harness(); await h.start(); position(h, 'execution', 3, true); await h.emit(event, payload);
    assert.equal(h.w().state.status, 'paused', event); assert.equal(h.w().state.slice, undefined, event);
  }
});
test('continuation occurs at final actionable boundary only and stops without progress', async () => {
  const h = harness(); await h.start();
  assert.equal(await h.emit('agent_before_settle', { outcome: 'error', context: { canContinue: true } }), undefined);
  assert.equal(await h.emit('agent_before_settle', { outcome: 'completed', context: { canContinue: false } }), undefined);
  assert.equal((await h.emit('agent_before_settle', { outcome: 'completed', context: { canContinue: true } })).continue, true);
  assert.equal(await h.emit('agent_before_settle', { outcome: 'completed', context: { canContinue: true } }), undefined);
  assert.equal(h.w().state.status, 'paused');
});
test('restore uses active branch progress but never refunds abandoned-branch child allocation', async () => {
  const h = harness(); await h.start('multi 合成任务'); const initial = structuredClone(h.entries);
  position(h, 'execution', 6, true);
  await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [{ role: 'Primary Output', agent: 'worker', task: 'one shot', paths: [] }] });
  h.setBranch(initial); await h.emit('session_tree');
  assert.equal(h.w().state.phase, 'entry'); assert.equal(h.w().state.status, 'paused'); assert.equal(h.w().state.allocations.length, 1);
});
test('fork/new Session never inherits parent workflow identity or progress', async () => {
  const h = harness(); await h.start(); h.setSessionId('forked-session'); await h.emit('session_start', { reason: 'fork' });
  assert.equal(h.w(), undefined); assert.equal(h.isEnabled(), false);
});
test('corrupt latest snapshot is fail-closed and cannot be reset by another start command', async () => {
  const h = harness(); await h.start(); h.entries.at(-1).data.state.version = 99;
  await h.emit('session_start', { reason: 'reload' }); assert.match(h.getRestoreError(), /状态版本/);
  assert.equal((await h.invoke('write', { path: 'anything.ts' })).isError, true);
  await h.commands.get('coding').handler('single 不能重置绕过', h.ctx); assert.equal(h.w(), undefined);
});
test('unresolved effects survive restoration and block resume until actual readback', async () => {
  const h = harness(); await h.start(); h.w().state.inFlight.push('unknown-op');
  await h.emit('agent_settled', { aborted: true }); await h.emit('session_start', { reason: 'reload' });
  assert.ok(h.w().state.inFlight.includes('unknown-op'));
  const resume = await h.invoke('coding_checkpoint', { action: 'resume', revision: h.w().state.revision, evidence: [h.userRef()] }); assert.equal(resume.isError, true);
  const read = await h.invoke('read', { path: 'synthetic.ts' });
  assert.equal((await h.invoke('coding_checkpoint', { action: 'resolve_effect', revision: h.w().state.revision, callId: 'unknown-op', evidence: [read.toolCall.id] })).isError, false);
});
test('explicit volatile flag avoids appendEntry; no global configuration is modified', async () => {
  const h = harness({ flags: { 'coding-volatile': true } }); await h.start(); await h.run(); assert.equal(h.entries.length, 0);
});
test('large actual result is paginated without rerunning the target task', async () => {
  const h = harness(); await h.start(); h.raw.get('bash').execute = async () => body('x'.repeat(70000));
  const outcome = await h.run(); const record = JSON.parse(outcome.result.content[0].text); assert.equal(record.nextOffset, 24000);
  const page = await h.invoke('coding_checkpoint', { action: 'result', resultId: record.callId, offset: record.nextOffset });
  assert.equal(page.isError, false); assert.equal(h.calls.filter(c => c.name === 'bash').length, 1);
});
test('host-confirmed blocked delegate does not consume an unbound reservation after reload', async () => {
  const h = harness(); await h.start('multi 合成任务'); position(h, 'execution', 6, true);
  h.pi.on('tool_call', event => event.toolName === 'subagent' ? { block: true, reason: 'synthetic host denial before execute' } : undefined);
  const outcome = await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [{ role: 'Primary Output', agent: 'worker', task: 'test', paths: [] }] });
  assert.equal(outcome.isError, true); assert.equal(h.w().state.allocations.length, 0);
  await h.emit('session_start', { reason: 'reload' }); assert.equal(h.w().state.allocations.length, 0); assert.equal(h.w().state.childCount, 1);
});
test('volatile tree navigation retains current budget and does not wipe live state', async () => {
  const h = harness({ flags: { 'coding-volatile': true } }); await h.start('multi 合成任务'); position(h, 'execution', 6, true);
  await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [{ role: 'Primary Output', agent: 'worker', task: 'test', paths: [] }] });
  await h.emit('session_tree'); assert.equal(h.w().state.allocations.length, 1); assert.equal(h.w().state.status, 'paused'); assert.equal(h.entries.length, 0);
});
test('status observation pagination does not return the entire state/report history', async () => {
  const h = harness(); await h.start(); for (let i = 0; i < 50; i++) h.w().observe(`r-${i}`, 'read', 'read', true);
  const result = await h.invoke('coding_checkpoint', { action: 'status', offset: 0 }); const value = JSON.parse(result.result.content[0].text);
  assert.equal(value.observations.length, 24); assert.equal(value.nextObservationsOffset, 24); assert.equal('reports' in value, false);
});
const command = (h, args) => h.commands.get('coding').handler(args, h.ctx);
const finish = h => { h.w().state.status = 'complete'; h.w().state.phase = 'delivery'; h.w().state.step = catalog.modules['delivery-acceptance'].checkpoints.length; };
for (const mode of ['single', 'multi']) test(`startup registry asks mode then audit for ${mode}`, async () => {
  const prompts = [], choices = [mode === 'multi' ? 'multi（默认预算1）' : 'single', '使用默认（balanced / milestone_only / full）'];
  const h = harness({ hasUI: true, select: async (title, values) => { prompts.push(title); assert.ok(values.includes(choices[0])); return choices.shift(); } });
  await command(h, 'start 合成启动');
  assert.ok(h.w()); assert.match(prompts[0], /1\. Coding/); assert.match(prompts[1], /2\. 审计/);
  assert.equal(h.w().state.childCount, mode === 'multi' ? 1 : 0);
  assert.deepEqual(h.w().state.audit.source, { audit_mode: 'default', root_reasoning_cadence: 'default', worker_reasoning_cadence: 'default' });
});
test('explicit fields skip questions; custom remaining fields have separate sources', async () => {
  const prompts = [], choices = ['定制未提供字段', 'off'];
  const h = harness({ hasUI: true, select: async title => { prompts.push(title); return choices.shift(); } });
  await command(h, 'multi 2 --audit-mode economy --worker-cadence milestone_only 显式任务');
  assert.equal(prompts.length, 2); assert.equal(prompts[1], 'root_reasoning_cadence');
  assert.equal(h.w().state.audit.root_reasoning_cadence, 'off');
  assert.ok(Object.values(h.w().state.audit.source).every(s => s === 'explicit'));
  const context = await h.emit('context', { messages: [] }); assert.match(context.messages[0].content, /"audit_mode":"economy"/);
  const status = await h.invoke('coding_checkpoint', { action: 'status' }); assert.match(status.result.content[0].text, /"audit"/);
});
test('defaults only apply to missing fields and never overwrite explicit ones', async () => {
  const h = harness(); await command(h, 'single --audit-mode full --audit-defaults task');
  assert.equal(h.w().state.audit.audit_mode, 'full'); assert.equal(h.w().state.audit.source.audit_mode, 'explicit');
  assert.equal(h.w().state.audit.source.root_reasoning_cadence, 'default');
});
for (const choices of [[undefined], ['multi（默认预算1）', undefined], ['single', '定制未提供字段', undefined]]) test(`cancel at ${choices.length} leaves no workflow or effects`, async () => {
  const h = harness({ hasUI: true, select: async () => choices.shift() }); await command(h, 'start task');
  assert.equal(h.w(), undefined); assert.equal(h.entries.length, 0); assert.equal(h.calls.length, 0);
  assert.equal((await h.invoke('bash', {})).isError, true); assert.equal(h.calls.length, 0);
});
test('headless missing answers and invalid explicit answers block without implicit defaults', async () => {
  for (const args of ['start task', 'single task', 'multi 0 --audit-defaults task', 'multi -1 --audit-defaults task', 'multi 1.5 --audit-defaults task', 'single --audit-mode unknown --audit-defaults task', 'multi --count NaN --audit-defaults task']) {
    const h = harness(); await command(h, args); assert.equal(h.w(), undefined, args); assert.equal(h.entries.length, 0);
    assert.equal((await h.invoke('read', {})).isError, true, args);
  }
  const h = harness({ flags: { 'coding-mode': 'single' } });
  await h.emit('before_agent_start', { messageType: 'user', prompt: 'task', systemPromptOptions: { sections: {} } });
  assert.equal(h.w(), undefined); assert.equal((await h.invoke('bash', {})).isError, true);
});
test('startup race is serialized and cancel invalidates late UI results', async () => {
  let release; const h = harness({ hasUI: true, select: () => new Promise(r => { release = r; }) });
  const pending = command(h, 'single task'); assert.equal((await h.invoke('bash', {})).isError, true);
  await command(h, 'single --audit-defaults competing'); assert.equal(h.w(), undefined);
  await command(h, 'cancel');
  await command(h, 'single --audit-defaults replacement'); const run = h.w().state.runId;
  release('使用默认（balanced / milestone_only / full）'); await pending;
  assert.equal(h.w().state.runId, run); assert.equal(h.entries.length, 1); assert.equal(h.messages.filter(m => m.opts?.triggerTurn).length, 1);
});
test('tree navigation while UI is open prevents stale startup commit', async () => {
  let release; const h = harness({ hasUI: true, select: () => new Promise(r => { release = r; }) });
  const pending = command(h, 'single task'); await Promise.resolve(); await h.emit('session_tree'); release('使用默认（balanced / milestone_only / full）'); await pending;
  assert.equal(h.w(), undefined); assert.equal(h.entries.length, 0);
});
for (const volatile of [false, true]) test(`confirmed answers survive tasks/reload/tree without budget refund, volatile=${volatile}`, async () => {
  const h = harness({ flags: { 'coding-volatile': volatile } }); await command(h, 'multi --audit-defaults task');
  position(h, 'execution', 6, true);
  await h.invoke('coding_delegate', { revision: h.w().state.revision, tool: 'subagent', evidence: [h.userRef()], jobs: [{ role: 'Primary Output', agent: 'worker', task: 'task', paths: [] }] });
  assert.match(h.calls.find(c => c.name === 'subagent').input.task, /会话审计偏好及每字段来源/);
  finish(h); await command(h, 'start second task'); assert.equal(h.w().state.allocations.length, 1); const audit = structuredClone(h.w().state.audit);
  await h.emit('session_start', { reason: 'reload' }); assert.deepEqual(h.w().state.audit, audit);
  await h.emit('session_tree'); assert.equal(h.w().state.allocations.length, 1);
  finish(h); await command(h, 'start third task'); assert.deepEqual(h.w().state.audit, audit); assert.equal(h.w().state.allocations.length, 1);
  if (volatile) assert.equal(h.entries.length, 0);
  h.setSessionId('fresh-fork'); await h.emit('session_start', { reason: 'fork' }); await command(h, 'start fork task'); assert.equal(h.w(), undefined);
});
test('answers survive navigation before the first workflow branch entry', async () => {
  const h = harness(); await command(h, 'single --audit-defaults task'); h.setBranch([]); await h.emit('session_tree');
  assert.equal(h.w(), undefined); await command(h, 'start second task'); assert.ok(h.w());
});
test('a fresh extension instance restores confirmed answers and rejects corrupted answer envelopes', async () => {
  const h = harness(); await command(h, 'multi 2 --audit-defaults task'); finish(h);
  // Persist a structurally complete snapshot using a real runtime persistence boundary.
  await h.emit('agent_settled', { aborted: true });
  const reloaded = harness({ entries: h.entries });
  await reloaded.emit('session_start', { reason: 'resume' });
  assert.equal(reloaded.getRestoreError(), '');
  await command(reloaded, 'start next task'); assert.ok(reloaded.w()); assert.equal(reloaded.w().state.childCount, 2);
  const bad = structuredClone(h.entries); bad.at(-1).data.answers.audit.audit_mode = 'economy';
  const corrupt = harness({ entries: bad }); await corrupt.emit('session_start', { reason: 'resume' });
  assert.match(corrupt.getRestoreError(), /冲突/); await command(corrupt, 'single --audit-defaults reset');
  assert.equal(corrupt.w(), undefined);
});
test('volatile lost-state reload/resume blocks without appending a fake recovery entry', async () => {
  for (const reason of ['reload', 'resume']) {
    const h = harness({ flags: { 'coding-volatile': true }, entries: [{ type: 'custom_message', customType: 'token-io.coding-hooks.v1.start', details: { sessionId: 'runtime-test' } }] }); await h.emit('session_start', { reason });
    assert.match(h.getRestoreError(), /volatile/); await command(h, 'multi --audit-defaults task');
    assert.equal(h.w(), undefined); assert.equal(h.entries.length, 1);
    assert.equal((await h.invoke('bash', {})).isError, true);
    h.setSessionId('fresh-session'); await h.emit('session_start', { reason: 'new' });
    await command(h, 'multi --audit-defaults task'); assert.ok(h.w()); assert.equal(h.entries.length, 1);
  }
});
for (const reason of ['reload', 'resume']) test(`volatile storage flag alone never opts in on ${reason}`, async () => {
  const h = harness({ flags: { 'coding-volatile': true } }); await h.emit('session_start', { reason });
  assert.equal(h.getRestoreError(), ''); assert.equal(h.isEnabled(), false);
  assert.equal((await h.invoke('bash', {})).isError, false); assert.equal(h.entries.length, 0);
});
test('headless explicit audit fields skip menus without marking them default', async () => {
  const h = harness();
  await command(h, 'start --mode multi --count 2 --audit-mode economy --root-cadence off --worker-cadence milestone_only task');
  assert.ok(h.w()); assert.equal(h.w().state.childCount, 2);
  assert.ok(Object.values(h.w().state.audit.source).every(s => s === 'explicit'));
});
test('CLI does not implicitly restart a completed task and late cancellation cannot poison a replacement', async () => {
  let release;
  const h = harness({ flags: { 'coding-mode': 'single' }, hasUI: true, select: () => new Promise(r => { release = r; }) });
  const event = prompt => ({ messageType: 'user', prompt, systemPromptOptions: { sections: {} } });
  const pending = h.emit('before_agent_start', event('initial')); await Promise.resolve();
  await command(h, 'cancel'); await command(h, 'single --audit-defaults replacement');
  const id = h.w().state.runId; release('使用默认（balanced / milestone_only / full）'); await pending;
  assert.equal(h.w().state.runId, id);
  assert.equal((await h.invoke('read', {})).isError, false);
  finish(h); await h.emit('before_agent_start', event('later'));
  assert.equal(h.w().state.runId, id); assert.equal(h.w().state.status, 'complete');
  await command(h, 'start explicitly requested later task'); assert.notEqual(h.w().state.runId, id);
});
test('custom budget input cancellation and invalid answers never fall back to one', async () => {
  for (const count of [undefined, '', '0', '-1', '1.1', '9007199254740992']) {
    const h = harness({ hasUI: true, select: async () => 'multi（自定义数量）', input: async () => count });
    await command(h, 'start task'); assert.equal(h.w(), undefined); assert.equal(h.entries.length, 0);
  }
  const h = harness({ hasUI: true, select: async () => 'single' });
  await command(h, 'start --count 2 --audit-defaults task'); assert.equal(h.w(), undefined);
});
test('cancel during mode question does not open a later audit dialog', async () => {
  let release, selects = 0;
  const h = harness({ hasUI: true, select: () => { selects++; return new Promise(r => { release = r; }); } });
  const pending = command(h, 'start task'); await command(h, 'cancel'); release('single'); await pending;
  assert.equal(selects, 1); assert.equal(h.w(), undefined);
});
test('default extension never takes over normal input', async () => {
  const h = harness(); await h.emit('before_agent_start', { messageType: 'user', prompt: 'task', systemPromptOptions: { sections: {} } });
  assert.equal(h.w(), undefined); assert.equal(h.entries.length, 0); assert.equal((await h.invoke('read', {})).isError, false);
});
test('scope checks reject an existing symlink to outside the project', () => {
  const root = mkdtempSync(join(tmpdir(), 'coding-paths-')); const outside = mkdtempSync(join(tmpdir(), 'coding-outside-'));
  try { symlinkSync(outside, join(root, 'escape')); writeFileSync(join(root, 'safe.ts'), 'test'); assert.equal(scopedPath(root, 'safe.ts'), 'safe.ts'); assert.throws(() => scopedPath(root, 'escape/file.ts'), /符号链接/); symlinkSync(root, join(root, 'alias')); assert.equal(scopedPath(root, 'alias/safe.ts'), 'safe.ts'); }
  finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});
