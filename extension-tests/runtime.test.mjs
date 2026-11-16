import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCatalog } from '../extensions/coding-workflow/catalog.ts';
import { installWorkflow, scopedPath, compatibleSubagent } from '../extensions/coding-workflow/runtime.ts';
const catalog = loadCatalog();
const subSchema = { type: 'object', properties: { agent: { type: 'string' }, task: { type: 'string' }, cwd: { type: 'string' } }, required: ['agent', 'task'] };
const body = value => ({ content: [{ type: 'text', text: value }], details: {} });
function harness(options = {}) {
  const handlers = new Map(), definitions = new Map(), commands = new Map(), entries = [], messages = [], calls = [];
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
  const ctx = { cwd: process.cwd(), hasUI: false, sessionManager: { getSessionId: () => sessionId, getEntries: () => entries, getBranch: () => branch ?? entries } };
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
  async function start(args = 'single 合成任务，用户明确禁止持久化计划') { await commands.get('coding').handler(args, ctx); assert.ok(w(), messages.at(-1)?.message.content); }
  return { ...installed, pi, raw, definitions, ctx, entries, messages, calls, emit, invoke, start, run, w, userRef, commands,
    setBranch(value) { branch = value; }, setSessionId(value) { sessionId = value; } };
}
function position(h, phase, step, slice = false) {
  const s = h.w().state; s.phase = phase; s.step = step; s.plan = 'prohibited';
  if (slice) s.slice = { objective: 'synthetic scoped task', paths: ['synthetic.ts'], mutations: ['content', 'documentation'], returnConditions: 'return evidence', unreleased: 'Git/network', evidence: [h.userRef()] };
}

test('package declares one extension and excludes local Serena metadata by a narrow files allowlist', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.pi.extensions, ['./extensions/coding-workflow/index.ts']);
  assert.deepEqual(manifest.files, ['extensions/coding-workflow/*.ts', 'docs/skill', 'README.md']);
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
  const h = harness({ flags: { 'coding-mode': 'single' } });
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
  assert.ok(second.messages[1].content.length < 32000);
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
test('scope checks reject an existing symlink to outside the project', () => {
  const root = mkdtempSync(join(tmpdir(), 'coding-paths-')); const outside = mkdtempSync(join(tmpdir(), 'coding-outside-'));
  try { symlinkSync(outside, join(root, 'escape')); writeFileSync(join(root, 'safe.ts'), 'test'); assert.equal(scopedPath(root, 'safe.ts'), 'safe.ts'); assert.throws(() => scopedPath(root, 'escape/file.ts'), /符号链接/); symlinkSync(root, join(root, 'alias')); assert.equal(scopedPath(root, 'alias/safe.ts'), 'safe.ts'); }
  finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});
