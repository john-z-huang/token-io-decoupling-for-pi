import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentModule, SIGNALS, PHASES } from '../extensions/coding-workflow/catalog.ts';
import { exactPath, ROLES, sameEpoch, Workflow } from '../extensions/coding-workflow/engine.ts';
import { renderContext } from '../extensions/coding-workflow/runtime.ts';
import { catalog, fresh, report, slice, step, until } from './engine-fixture.mjs';

test('both routes share seven ordered modules and select the correct executor module', () => {
  assert.equal(PHASES.length, 7);
  assert.deepEqual(
    PHASES.map((phase) => catalog.routes.single.steps[phase].id),
    ['SM01', 'SM02', 'SM03', 'SM04', 'SM05', 'SM06', 'SM07'],
  );
  assert.deepEqual(
    PHASES.map((phase) => catalog.routes.multi.steps[phase].id),
    ['MM01', 'MM02', 'MM03', 'MM04', 'MM05', 'MM06', 'MM07'],
  );
  assert.equal(currentModule(catalog, 'execution', 'single').name, 'single-execution');
  assert.equal(currentModule(catalog, 'execution', 'multi').name, 'delegated-execution');
});
test('single route can traverse all seven modules with actual synthetic observations', () => {
  const w = fresh();
  until(w, 'DA05');
  step(w);
  assert.equal(w.state.status, 'complete');
  assert.ok(sameEpoch(w.state.verified, w.state.epoch));
});
test('multi route can traverse all modules without creating an unnecessary child', () => {
  const w = fresh('multi');
  until(w, 'DE02');
  step(w, { facts: { executor: 'root' } });
  assert.equal(w.checkpoint.id, 'DE04');
  assert.throws(() => step(w), /放行当前 Slice/);
  w.release(w.state.revision, slice);
  step(w);
  assert.equal(w.checkpoint.id, 'DE07');
  assert.deepEqual(w.state.reports.find((r) => r.report.checkpoint === 'DE02').notApplicable, [
    'DE03',
    'DE05',
    'DE06',
  ]);
  assert.ok(!w.state.reports.some((r) => ['DE03', 'DE05', 'DE06'].includes(r.report.checkpoint)));
  until(w, 'DA05');
  step(w);
  assert.equal(w.state.status, 'complete');
  assert.equal(w.state.allocations.length, 0);
});
test('switching from Root to a child rechecks role, Slice and current dispatch evidence', () => {
  const w = fresh('multi');
  until(w, 'DE02');
  step(w, { facts: { executor: 'root' } });
  w.release(w.state.revision, slice);
  step(w);
  const jobs = [{ role: ROLES[0], callId: 'new-child' }];
  assert.throws(() => w.reserve(jobs), /DE06/);
  w.signal(w.state.revision, {
    signal: 'executor_changed',
    evidence: ['user-1'],
    reason: '新切片确需子代理',
  });
  assert.equal(w.checkpoint.id, 'DE02');
  assert.equal(w.state.slice, undefined);
  step(w);
  assert.throws(() => w.release(w.state.revision, slice), /放行条件/);
  step(w);
  w.release(w.state.revision, slice);
  step(w);
  step(w);
  assert.equal(w.checkpoint.id, 'DE06');
  const changed = new Workflow(catalog, w.snapshot());
  changed.release(changed.state.revision, slice);
  assert.throws(() => changed.reserve(jobs), /DE06/);
  assert.equal(changed.state.allocations.length, 0);
  assert.equal(w.reserve(jobs).length, 1);
});
test('wrong revision, skipped checkpoints, forged evidence and nonconditional N/A fail atomically', () => {
  const w = fresh();
  const before = w.snapshot();
  assert.throws(() => w.report(-1, [report(w)]), /revision/);
  assert.throws(() => w.report(w.state.revision, [report(w, { checkpoint: 'ER03' })]), /不能跳步/);
  assert.throws(() => step(w, { evidence: ['fake-call'] }), /真实观察/);
  assert.throws(() => step(w, { outcome: 'not_applicable' }), /必需检查点/);
  assert.deepEqual(w.snapshot(), before);
});
test('invalid later report rolls back the entire report batch', () => {
  const w = fresh();
  const before = w.snapshot();
  assert.throws(
    () => w.report(w.state.revision, [report(w), report(w, { checkpoint: 'ER01', facts: {} })]),
    /independence/,
  );
  assert.deepEqual(w.snapshot(), before);
});
test('a batch must stop at a module boundary to consume next module hooks', () => {
  const w = fresh();
  const before = w.snapshot();
  const items = ['ER00', 'ER01', 'ER02', 'ER03', 'SR00'].map((checkpoint) =>
    report(w, { checkpoint, facts: { independence: 'not_required' } }),
  );
  assert.throws(() => w.report(w.state.revision, items), /跨模块/);
  assert.deepEqual(w.snapshot(), before);
});
test('plan cannot be excused by missing memory tools or by a fabricated receipt', () => {
  const w = fresh();
  until(w, 'WD03');
  assert.throws(() => step(w, { facts: { plan: 'unavailable' } }), /计划必须/);
  assert.throws(() => step(w, { facts: { plan: 'persisted' } }), /计划必须/);
  w.observe({ id: 'memory-1', tool: 'real-memory-adapter', effect: 'memory', ok: true });
  step(w, { facts: { plan: 'persisted' }, evidence: ['memory-1'] });
  assert.equal(w.state.plan, 'persisted');
});
test('slice cannot be released early, outside the current stage or with path traversal', () => {
  const w = fresh();
  assert.throws(() => w.release(w.state.revision, slice), /放行/);
  until(w, 'SE02');
  assert.throws(() => w.release(w.state.revision, { ...slice, paths: ['../escape.ts'] }), /路径/);
  w.release(w.state.revision, slice);
  assert.equal(w.canRun('content', 'example.ts'), undefined);
  assert.match(w.canRun('content', 'other.ts'), /路径/);
  assert.match(w.canRun('git'), /影响未被/);
});
test('exact paths reject traversal, absolute paths, .git, empty segments and aliases', () => {
  for (const path of [
    '../a',
    '/tmp/a',
    'a/../b',
    '.git/HEAD',
    'a//b',
    '@target',
    'a\\b',
    'a/./b',
    'src/*.ts',
    'src/?.ts',
    'src/[ab].ts',
    'src/{a,b}.ts',
    'src/a\u0000.ts',
    'src/a\u001f.ts',
  ])
    assert.equal(exactPath(path), false, path);
  assert.equal(exactPath('src/example.ts'), true);
});
test('failed or unavailable check cannot be reported as passed verification', () => {
  const w = fresh();
  until(w, 'VR03');
  assert.throws(() => step(w), /实际检查/);
  w.observe({ id: 'failed-check', tool: 'check', effect: 'check', ok: false });
  assert.throws(() => step(w, { evidence: ['failed-check'] }), /实际检查/);
});
test('single mode never reserves subagents; multi waits until DE06', () => {
  const single = fresh();
  until(single, 'SE03');
  assert.throws(() => single.reserve([{ role: ROLES[0], callId: 'c' }]), /Multi/);
  const multi = fresh('multi');
  until(multi, 'DE04');
  multi.release(multi.state.revision, slice);
  step(multi);
  assert.throws(() => multi.reserve([{ role: ROLES[0], callId: 'c' }]), /DE06/);
  step(multi);
  assert.equal(multi.checkpoint.id, 'DE06');
  assert.equal(multi.reserve([{ role: ROLES[0], callId: 'c' }]).length, 1);
});
test('reserve is atomic, roles unique, and terminal tasks do not free approved slots', () => {
  const w = fresh('multi');
  until(w, 'DE04');
  w.release(w.state.revision, slice);
  until(w, 'DE06');
  assert.throws(
    () =>
      w.reserve([
        { role: ROLES[0], callId: '1' },
        { role: ROLES[1], callId: '2' },
      ]),
    /预算/,
  );
  assert.equal(w.state.allocations.length, 0);
  w.reserve([{ role: ROLES[0], callId: '1' }]);
  w.state.allocations[0].status = 'completed';
  assert.throws(() => w.reserve([{ role: ROLES[1], callId: '2' }]), /预算/);
  w.addSlot(ROLES[1]);
  assert.equal(w.state.childCount, 2);
  assert.throws(() => w.reserve([{ role: ROLES[0], callId: '2' }]), /职责重复/);
});
test('a distinct read-only verifier can be allocated at VR02 with sufficient explicit budget', () => {
  const w = fresh('multi');
  until(w, 'VR02');
  w.reserve([{ role: ROLES[1], callId: 'verifier' }]);
  assert.equal(w.state.allocations[0].role, ROLES[1]);
});
test('all signals have explicit hook routing; unrelated advice/materialization stay unloaded', () => {
  for (const signal of SIGNALS)
    assert.ok(Object.values(catalog.hookTriggers).some((triggers) => triggers.includes(signal)));
  const context = renderContext(fresh());
  assert.ok(!context.includes('[Hook:materialization]') && !context.includes('[Hook:advisory]'));
});
