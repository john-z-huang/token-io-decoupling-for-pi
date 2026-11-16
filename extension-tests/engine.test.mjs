import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadCatalog, currentModule, parseModule, classifySource, phaseHooks, signalHooks, SIGNALS, PHASES } from '../extensions/coding-workflow/catalog.ts';
import { makeState, Workflow, restoreState, exactPath, ROLES, sameEpoch } from '../extensions/coding-workflow/engine.ts';
import { MAX_CONTEXT, renderContext } from '../extensions/coding-workflow/runtime.ts';
const catalog = loadCatalog();
export function fresh(mode = 'single', count = mode === 'single' ? 0 : 1) {
  const w = new Workflow(catalog, makeState(catalog, 'session-test', process.cwd(), mode, count, '合成测试任务；用户明确禁止持久化计划'));
  w.state.audit = { audit_mode: 'balanced', root_reasoning_cadence: 'milestone_only', worker_reasoning_cadence: 'full', source: { audit_mode: 'default', root_reasoning_cadence: 'default', worker_reasoning_cadence: 'default' } };
  w.observe('user-1', '/coding', 'user', true); return w;
}
export function report(w, overrides = {}) {
  const id = w.checkpoint.id;
  const facts = { ER01: { independence: 'not_required' }, WD03: { plan: 'prohibited' }, VR03: { verification: 'passed' }, DA03: { acceptance: 'satisfied' } }[id];
  return { checkpoint: id, outcome: 'complete', summary: '合成证据摘要，非真实项目验收', evidence: id === 'VR03' ? [w.state.observations.filter(o => o.effect === 'check').at(-1)?.id ?? 'user-1'] : ['user-1'], facts, ...overrides };
}
export function step(w, overrides) { w.report(w.state.revision, [report(w, overrides)]); }
export function until(w, checkpoint) {
  let budget = 100;
  while (w.checkpoint?.id !== checkpoint && budget--) {
    if (w.checkpoint?.id === 'VR03') w.observe(w.state.observations.some(o => o.id === 'check-1') ? `check-${w.state.revision}` : 'check-1', 'synthetic-test', 'check', true);
    step(w);
  }
  assert.ok(budget > 0, `未到达 ${checkpoint}`);
}
const slice = { objective: '已授权的合成输出', paths: ['example.ts'], mutations: ['content'], returnConditions: '产物及检查证据返回', unreleased: 'Git、网络和扩容', evidence: ['user-1'] };

test('all maintained Markdown sources have hook or navigation/reference ownership', () => {
  assert.ok(catalog.coverage.length >= 119);
  assert.equal(catalog.coverage.filter(c => c.path.includes('layer-01-') && c.kind === 'rule').length, 41);
  assert.ok(catalog.coverage.every(c => c.hooks.length));
  assert.throws(() => classifySource('references/new-policy/rule.md'), /没有 Hook/);
});
test('both routes share seven ordered modules and select the correct executor module', () => {
  assert.equal(PHASES.length, 7);
  assert.equal(currentModule(catalog, 'execution', 'single').name, 'single-execution');
  assert.equal(currentModule(catalog, 'execution', 'multi').name, 'delegated-execution');
});
test('changed checkpoint shape is rejected instead of inferred', () => {
  assert.throws(() => parseModule('entry-readiness.md', '## 有序模块清单\n1. **ER99 — 无效。** 不允许\n'), /检查点契约变化/);
});
test('single route can traverse all seven modules with actual synthetic observations', () => {
  const w = fresh(); until(w, 'DA05'); step(w);
  assert.equal(w.state.status, 'complete'); assert.ok(sameEpoch(w.state.verified, w.state.epoch));
});
test('multi route can traverse all modules without creating an unnecessary child', () => {
  const w = fresh('multi'); until(w, 'DA05'); step(w);
  assert.equal(w.state.status, 'complete'); assert.equal(w.state.allocations.length, 0);
});
test('wrong revision, skipped checkpoints, forged evidence and nonconditional N/A fail atomically', () => {
  const w = fresh(); const before = w.snapshot();
  assert.throws(() => w.report(-1, [report(w)]), /revision/);
  assert.throws(() => w.report(w.state.revision, [report(w, { checkpoint: 'ER03' })]), /不能跳步/);
  assert.throws(() => step(w, { evidence: ['fake-call'] }), /真实观察/);
  assert.throws(() => step(w, { outcome: 'not_applicable' }), /必需检查点/);
  assert.deepEqual(w.snapshot(), before);
});
test('invalid later report rolls back the entire report batch', () => {
  const w = fresh(); const before = w.snapshot();
  assert.throws(() => w.report(w.state.revision, [report(w), report(w, { checkpoint: 'ER01', facts: {} })]), /independence/);
  assert.deepEqual(w.snapshot(), before);
});
test('a batch must stop at a module boundary to consume next module hooks', () => {
  const w = fresh(); const before = w.snapshot();
  const items = ['ER00', 'ER01', 'ER02', 'ER03', 'SR00'].map(checkpoint => report(w, { checkpoint, facts: { independence: 'not_required' } }));
  assert.throws(() => w.report(w.state.revision, items), /跨模块/); assert.deepEqual(w.snapshot(), before);
});
test('plan cannot be excused by missing memory tools or by a fabricated receipt', () => {
  const w = fresh(); until(w, 'WD03');
  assert.throws(() => step(w, { facts: { plan: 'unavailable' } }), /计划必须/);
  assert.throws(() => step(w, { facts: { plan: 'persisted' } }), /计划必须/);
  w.observe('memory-1', 'real-memory-adapter', 'memory', true);
  step(w, { facts: { plan: 'persisted' }, evidence: ['memory-1'] }); assert.equal(w.state.plan, 'persisted');
});
test('slice cannot be released early, outside the current stage or with path traversal', () => {
  const w = fresh(); assert.throws(() => w.release(w.state.revision, slice), /放行/);
  until(w, 'SE02'); assert.throws(() => w.release(w.state.revision, { ...slice, paths: ['../escape.ts'] }), /路径/);
  w.release(w.state.revision, slice);
  assert.equal(w.canRun('content', 'example.ts'), undefined); assert.match(w.canRun('content', 'other.ts'), /路径/);
  assert.match(w.canRun('git'), /影响未被/);
});
test('exact paths reject traversal, absolute paths, .git, empty segments and aliases', () => {
  for (const path of ['../a', '/tmp/a', 'a/../b', '.git/HEAD', 'a//b', '@target', 'a\\b', 'a/./b', 'src/*.ts', 'src/?.ts', 'src/[ab].ts']) assert.equal(exactPath(path), false, path);
  assert.equal(exactPath('src/example.ts'), true);
});
test('failed or unavailable check cannot be reported as passed verification', () => {
  const w = fresh(); until(w, 'VR03');
  assert.throws(() => step(w), /实际检查/);
  w.observe('failed-check', 'check', 'check', false);
  assert.throws(() => step(w, { evidence: ['failed-check'] }), /实际检查/);
});
test('documentation writes return through verification and resume after the write checkpoint', () => {
  const w = fresh(); until(w, 'DOC02'); w.mutate('documentation');
  until(w, 'DOC06'); step(w); assert.equal(w.checkpoint.id, 'VR00');
  until(w, 'VR06'); step(w); assert.equal(w.checkpoint.id, 'DOC04');
  assert.equal(w.state.reports.filter(r => r.report.checkpoint === 'DOC02').length, 1);
  until(w, 'DA05'); step(w); assert.equal(w.state.status, 'complete');
});
test('Git writes reverify before acceptance without replaying DA02', () => {
  const w = fresh(); until(w, 'DA02'); w.mutate('git'); step(w);
  step(w); assert.equal(w.checkpoint.id, 'VR00');
  until(w, 'VR06'); step(w); assert.equal(w.checkpoint.id, 'DA03');
  assert.equal(w.state.reports.filter(r => r.report.checkpoint === 'DA02').length, 1);
  until(w, 'DA05'); step(w); assert.equal(w.state.status, 'complete');
});
test('repair returns to current Verification, not an extra verification loop', () => {
  const w = fresh(); until(w, 'VR05');
  w.signal(w.state.revision, 'repair_required', ['check-1'], '当前 Contract 内修复');
  assert.equal(w.checkpoint.id, 'SE00'); w.mutate('content'); until(w, 'VR06'); step(w);
  assert.equal(w.checkpoint.id, 'DOC00');
});
test('repair during documentation revalidation preserves documentation continuation', () => {
  const w = fresh(); until(w, 'DOC02'); w.mutate('documentation'); until(w, 'VR05');
  w.signal(w.state.revision, 'repair_required', ['check-1'], '聚焦修复');
  until(w, 'VR06'); step(w); assert.equal(w.checkpoint.id, 'DOC04');
});
test('prerequisite pause keeps the exact checkpoint and revokes any slice', () => {
  const w = fresh(); until(w, 'SE02'); w.release(w.state.revision, slice);
  step(w, { outcome: 'needs_prerequisite', summary: 'owner=Contract，原位置=SE02，尚无写效果' });
  assert.equal(w.checkpoint.id, 'SE02'); assert.equal(w.state.status, 'paused'); assert.equal(w.state.slice, undefined);
  assert.throws(() => w.resume(w.state.revision, ['user-1']), /实际读回/);
  w.observe('readback', 'read', 'read', true); w.resume(w.state.revision, ['readback']); assert.equal(w.checkpoint.id, 'SE02');
});
test('unknown effects require actual readback and cannot pass final verification', () => {
  const w = fresh(); until(w, 'VR06'); w.state.inFlight.push('unknown-call');
  assert.throws(() => step(w), /结果不明/);
  assert.throws(() => w.resolveEffect(w.state.revision, 'unknown-call', ['user-1']), /实际读回/);
  w.observe('readback', 'read', 'read', true); w.resolveEffect(w.state.revision, 'unknown-call', ['readback']); step(w);
});
test('single mode never reserves subagents; multi waits until DE06', () => {
  const single = fresh(); until(single, 'SE03'); assert.throws(() => single.reserve([{ role: ROLES[0], callId: 'c' }]), /Multi/);
  const multi = fresh('multi'); until(multi, 'DE04'); multi.release(multi.state.revision, slice); step(multi);
  assert.throws(() => multi.reserve([{ role: ROLES[0], callId: 'c' }]), /DE06/); step(multi);
  assert.equal(multi.checkpoint.id, 'DE06'); assert.equal(multi.reserve([{ role: ROLES[0], callId: 'c' }]).length, 1);
});
test('reserve is atomic, roles unique, and terminal tasks do not free approved slots', () => {
  const w = fresh('multi'); until(w, 'DE04'); w.release(w.state.revision, slice); until(w, 'DE06');
  assert.throws(() => w.reserve([{ role: ROLES[0], callId: '1' }, { role: ROLES[1], callId: '2' }]), /预算/); assert.equal(w.state.allocations.length, 0);
  w.reserve([{ role: ROLES[0], callId: '1' }]); w.state.allocations[0].status = 'completed';
  assert.throws(() => w.reserve([{ role: ROLES[1], callId: '2' }]), /预算/);
  w.addSlot(ROLES[1]); assert.equal(w.state.childCount, 2);
  assert.throws(() => w.reserve([{ role: ROLES[0], callId: '2' }]), /职责重复/);
});
test('a distinct read-only verifier can be allocated at VR02 with sufficient explicit budget', () => {
  const w = fresh('multi'); until(w, 'VR02');
  w.reserve([{ role: ROLES[1], callId: 'verifier' }]); assert.equal(w.state.allocations[0].role, ROLES[1]);
});
test('all signals have explicit hook routing; unrelated advice/materialization stay unloaded', () => {
  for (const signal of SIGNALS) assert.ok(signalHooks(signal).length);
  assert.ok(!phaseHooks('entry', 'single').includes('materialization'));
  assert.ok(!renderContext(fresh()).includes('[Hook:advisory]'));
});
test('semantic changes retain mode/count and bound allocations; invalid signals are atomic', () => {
  const w = fresh('multi'); const original = w.snapshot();
  assert.throws(() => w.signal(w.state.revision, 'repair_required', ['user-1'], '错误阶段'), /验证边界/); assert.deepEqual(w.snapshot(), original);
  until(w, 'DE04'); w.release(w.state.revision, slice); until(w, 'DE06');
  const [allocation] = w.reserve([{ role: ROLES[0], callId: 'actual-task' }]);
  w.signal(w.state.revision, 'requirements_changed', ['user-1'], '实际需求变更');
  assert.equal(w.checkpoint.id, 'ER00'); assert.equal(w.state.mode, 'multi'); assert.equal(w.state.childCount, 1);
  assert.equal(w.state.allocations[0].id, allocation.id); assert.equal(w.state.slice, undefined);
});
test('restoration rejects wrong version, session, scope, digest and malformed states', () => {
  const s = fresh().snapshot();
  assert.equal(restoreState(catalog, s, 'session-test', process.cwd()).runId, s.runId);
  for (const patch of [{ version: 2 }, { sessionId: 'other' }, { cwd: '/other' }, { catalogHash: 'bad' }, { step: 999 }, { childCount: 1 }, { signals: ['invalid'] }]) assert.throws(() => restoreState(catalog, { ...s, ...patch }, 'session-test', process.cwd()));
});
test('bounded continuation stops with no checkpoint progress and has a hard run budget', () => {
  const w = fresh(); assert.equal(w.nudge(), true); assert.equal(w.nudge(), false); assert.equal(w.state.status, 'paused');
  const another = fresh(); another.state.autoTurns = 8; assert.equal(another.nudge(), false);
});
test('a check from an older epoch cannot verify changed content', () => {
  const w = fresh(); until(w, 'VR03'); w.observe('old-check', 'test', 'check', true); w.mutate('content');
  assert.throws(() => step(w, { evidence: ['old-check'] }), /当前 epoch/);
});
test('completed history remains structurally restorable after pause or external change', () => {
  const w = fresh(); until(w, 'DA05'); step(w); w.mutate('git'); w.pause('用户实际状态变化，旧验收不是当前证明');
  assert.equal(w.state.verified, undefined); assert.equal(w.state.status, 'complete');
  assert.equal(restoreState(catalog, w.snapshot(), 'session-test', process.cwd()).status, 'complete');
});
test('default contexts remain bounded for both routes even with a full observation window', () => {
  for (const mode of ['single', 'multi']) for (const phase of PHASES) {
    const w = fresh(mode); w.state.phase = phase;
    for (let i = 0; i < 128; i++) w.observe(`observation-${i}`, 'synthetic-read', 'read', true);
    assert.ok(renderContext(w).length < MAX_CONTEXT, `${mode}/${phase}`);
  }
});
test('completed state rejects semantic signal mutation', () => {
  const w = fresh(); until(w, 'DA05'); step(w); const before = w.snapshot();
  assert.throws(() => w.signal(w.state.revision, 'requirements_changed', ['user-1'], '新任务'), /终态/); assert.deepEqual(w.snapshot(), before);
});
