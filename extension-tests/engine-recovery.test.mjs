import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PHASES } from '../extensions/coding-workflow/catalog.ts';
import { restoreState, ROLES, sameEpoch } from '../extensions/coding-workflow/engine.ts';
import { MAX_CONTEXT, renderContext } from '../extensions/coding-workflow/runtime.ts';
import { catalog, fresh, report, slice, step, until } from './engine-fixture.mjs';

test('documentation writes return through verification and resume after the write checkpoint', () => {
  for (const [dimension, boundary] of [
    ['content', 'DOC04'],
    ['documentation', 'DOC06'],
  ]) {
    const w = fresh();
    until(w, 'DOC02');
    w.mutate(dimension);
    until(w, boundary);
    step(w);
    assert.equal(w.checkpoint.id, 'VR00');
    until(w, 'VR06');
    step(w);
    assert.equal(w.checkpoint.id, 'DOC04');
    assert.equal(w.state.reports.filter((r) => r.report.checkpoint === 'DOC02').length, 1);
    until(w, 'DA05');
    step(w);
    assert.equal(w.state.status, 'complete');
  }
});
test('current documentation checks can refresh just the documentation epoch', () => {
  const w = fresh();
  until(w, 'DOC02');
  w.mutate('documentation');
  until(w, 'DOC05');
  w.observe({ id: 'doc-check', tool: 'synthetic link check', effect: 'check', ok: true });
  step(w, { facts: { verification: 'passed' }, evidence: ['doc-check'] });
  step(w);
  assert.equal(w.checkpoint.id, 'DA00');
  assert.ok(sameEpoch(w.state.verified, w.state.epoch));
});
test('Git writes reverify before acceptance without replaying DA02', () => {
  const w = fresh();
  until(w, 'DA01');
  w.mutate('git');
  step(w);
  assert.equal(w.checkpoint.id, 'DA02');
  const gitSlice = { ...slice, mutations: ['git'], paths: [] };
  w.release(w.state.revision, gitSlice);
  w.mutate('content');
  assert.match(w.canRun('git'), /当前内容和文档验证/);
  w.pause('读回受影响状态');
  w.observe({ id: 'readback', tool: 'read', effect: 'read', ok: true });
  w.resume(w.state.revision, ['readback']);
  assert.equal(w.checkpoint.id, 'VR00');
  until(w, 'DA02');
  w.release(w.state.revision, gitSlice);
  w.mutate('git');
  assert.equal(w.canRun('git'), undefined);
  step(w);
  assert.match(w.canRun('git'), /DA02/);
  step(w);
  assert.equal(w.checkpoint.id, 'VR00');
  until(w, 'VR06');
  step(w);
  assert.equal(w.checkpoint.id, 'DA03');
  assert.equal(w.state.reports.filter((r) => r.report.checkpoint === 'DA02').length, 1);
  until(w, 'DA05');
  step(w);
  assert.equal(w.state.status, 'complete');
});
test('repair returns to current Verification, not an extra verification loop', () => {
  const w = fresh();
  until(w, 'VR05');
  w.signal(w.state.revision, {
    signal: 'repair_required',
    evidence: ['check-1'],
    reason: '当前 Contract 内修复',
  });
  assert.equal(w.checkpoint.id, 'SE00');
  w.mutate('content');
  until(w, 'VR06');
  step(w);
  assert.equal(w.checkpoint.id, 'DOC00');
});
test('repair during documentation revalidation preserves documentation continuation', () => {
  const w = fresh();
  until(w, 'DOC02');
  w.mutate('documentation');
  until(w, 'VR05');
  w.signal(w.state.revision, { signal: 'repair_required', evidence: ['check-1'], reason: '聚焦修复' });
  until(w, 'VR06');
  step(w);
  assert.equal(w.checkpoint.id, 'DOC04');
});
test('prerequisite pause keeps the exact checkpoint and revokes any slice', () => {
  const w = fresh();
  until(w, 'SE02');
  w.release(w.state.revision, slice);
  step(w, { outcome: 'needs_prerequisite', summary: 'owner=Contract，原位置=SE02，尚无写效果' });
  assert.equal(w.checkpoint.id, 'SE02');
  assert.equal(w.state.status, 'paused');
  assert.equal(w.state.slice, undefined);
  assert.throws(() => w.resume(w.state.revision, ['user-1']), /实际读回/);
  w.observe({ id: 'readback', tool: 'read', effect: 'read', ok: true });
  w.resume(w.state.revision, ['readback']);
  assert.equal(w.checkpoint.id, 'SE02');
});
test('unknown effects require actual readback and cannot pass final verification', () => {
  const w = fresh();
  until(w, 'VR06');
  w.state.inFlight.push('unknown-call');
  assert.throws(() => step(w), /结果不明/);
  assert.throws(() => w.resolveEffect(w.state.revision, 'unknown-call', ['user-1']), /实际读回/);
  w.observe({ id: 'readback', tool: 'read', effect: 'read', ok: true });
  w.resolveEffect(w.state.revision, 'unknown-call', ['readback']);
  step(w);
});
test('semantic changes retain mode/count and bound allocations; invalid signals are atomic', () => {
  const w = fresh('multi');
  const original = w.snapshot();
  assert.throws(
    () => w.signal(w.state.revision, { signal: 'repair_required', evidence: ['user-1'], reason: '错误阶段' }),
    /验证边界/,
  );
  assert.deepEqual(w.snapshot(), original);
  until(w, 'DE04');
  w.release(w.state.revision, slice);
  until(w, 'DE06');
  const [allocation] = w.reserve([{ role: ROLES[0], callId: 'actual-task' }]);
  w.signal(w.state.revision, {
    signal: 'requirements_changed',
    evidence: ['user-1'],
    reason: '实际需求变更',
  });
  assert.equal(w.checkpoint.id, 'ER00');
  assert.equal(w.state.mode, 'multi');
  assert.equal(w.state.childCount, 1);
  assert.equal(w.state.allocations[0].id, allocation.id);
  assert.equal(w.state.slice, undefined);
  until(w, 'WD03');
  step(w);
  assert.equal(w.checkpoint.id, 'DE06');
  assert.equal(w.state.reports.filter((r) => r.report.checkpoint === 'SR02').length, 1);
  assert.throws(() => w.reserve([{ role: ROLES[0], callId: 'replay' }]), /DE06/);
});
test('decision recheck returns to the original checkpoint without resetting a resolved plan', () => {
  const w = fresh();
  until(w, 'DA02');
  w.signal(w.state.revision, {
    signal: 'decision_required',
    evidence: ['user-1'],
    reason: '补齐交付前置决策',
  });
  assert.equal(w.checkpoint.id, 'WD01');
  assert.equal(w.state.plan, 'prohibited');
  w.signal(w.state.revision, {
    signal: 'decision_required',
    evidence: ['user-1'],
    reason: '补齐同一决策的另一事实',
  });
  assert.deepEqual(w.state.decisionReturn, { phase: 'delivery', checkpoint: 'DA02' });
  until(w, 'WD03');
  step(w);
  assert.equal(w.checkpoint.id, 'DA02');
  assert.equal(w.state.decisionReturn, undefined);
  assert.equal(w.state.reports.filter((r) => r.report.checkpoint === 'DA01').length, 1);
});
test('decision recheck inside work definition stops at the requesting checkpoint', () => {
  for (const target of ['WD02', 'WD03']) {
    const w = fresh();
    until(w, target);
    w.signal(w.state.revision, {
      signal: 'decision_required',
      evidence: ['user-1'],
      reason: '补齐工作定义证据',
    });
    assert.deepEqual(w.state.decisionReturn, { phase: 'definition', checkpoint: target });
    assert.equal(w.checkpoint.id, 'WD01');
    const before = w.snapshot();
    const checkpoints = target === 'WD02' ? ['WD01', 'WD02'] : ['WD01', 'WD02', 'WD03'];
    assert.throws(
      () =>
        w.report(
          w.state.revision,
          checkpoints.map((checkpoint) => report(w, { checkpoint, facts: { plan: 'prohibited' } })),
        ),
      /不能跨越决策补证/,
    );
    assert.deepEqual(w.snapshot(), before);
    until(w, target);
    assert.equal(w.state.decisionReturn, undefined);
    assert.equal(w.state.plan, 'pending');
  }
});
test('decision recheck at final delivery preserves the plan already archived by DA04', () => {
  const w = fresh();
  until(w, 'WD03');
  w.observe({ id: 'plan-write', tool: 'synthetic-memory', effect: 'memory', ok: true });
  step(w, { facts: { plan: 'persisted' }, evidence: ['plan-write'] });
  until(w, 'DA04');
  w.observe({ id: 'plan-archive', tool: 'synthetic-memory', effect: 'memory', ok: true });
  step(w, { facts: { plan: 'archived' }, evidence: ['plan-archive'] });
  w.signal(w.state.revision, {
    signal: 'decision_required',
    evidence: ['user-1'],
    reason: '补齐交付结论的决策证据',
  });
  until(w, 'WD02');
  step(w);
  assert.equal(w.checkpoint.id, 'DA05');
  assert.equal(w.state.plan, 'archived');
  assert.equal(w.state.reports.filter((r) => r.report.checkpoint === 'WD03').length, 1);
  assert.equal(w.state.reports.filter((r) => r.report.checkpoint === 'DA04').length, 1);
  w.mutate('documentation');
  step(w);
  assert.equal(w.checkpoint.id, 'VR00');
  until(w, 'DA03');
  step(w);
  step(w, { facts: { plan: 'archived' }, evidence: ['plan-archive'] });
  assert.equal(w.state.reports.filter((r) => r.report.checkpoint === 'DA02').length, 1);
  step(w);
  assert.equal(w.state.status, 'complete');
});
test('changed requirements after archival need a current plan, checks and archive evidence', () => {
  const w = fresh();
  until(w, 'WD03');
  w.observe({ id: 'old-plan', tool: 'synthetic-memory', effect: 'memory', ok: true });
  step(w, { facts: { plan: 'persisted' }, evidence: ['old-plan'] });
  until(w, 'DA04');
  w.observe({ id: 'old-archive', tool: 'synthetic-memory', effect: 'memory', ok: true });
  step(w, { facts: { plan: 'archived' }, evidence: ['old-archive'] });

  w.signal(w.state.revision, {
    signal: 'requirements_changed',
    evidence: ['user-1'],
    reason: '合成验收条件变化',
  });
  until(w, 'WD03');
  assert.throws(() => step(w, { facts: { plan: 'persisted' }, evidence: ['old-plan'] }), /计划必须/);
  w.observe({ id: 'revised-plan', tool: 'synthetic-memory', effect: 'memory', ok: true });
  step(w, { facts: { plan: 'persisted' }, evidence: ['revised-plan'] });
  assert.equal(w.checkpoint.id, 'DA05');
  step(w);
  until(w, 'VR03');
  assert.throws(() => step(w, { evidence: ['check-1'] }), /当前 epoch/);
  w.observe({ id: 'current-check', tool: 'synthetic-check', effect: 'check', ok: true });
  step(w, { evidence: ['current-check'] });
  until(w, 'DA04');
  assert.throws(() => step(w, { facts: { plan: 'archived' }, evidence: ['old-archive'] }), /归档须/);
  w.observe({ id: 'current-archive', tool: 'synthetic-memory', effect: 'memory', ok: true });
  step(w, { facts: { plan: 'archived' }, evidence: ['current-archive'] });
  step(w);
  assert.equal(w.state.status, 'complete');
  assert.equal(w.state.reports.filter((r) => r.report.checkpoint === 'DA02').length, 1);
});
test('restoration rejects wrong version, session, scope, digest and malformed states', () => {
  const s = fresh().snapshot();
  assert.equal(restoreState(catalog, s, { sessionId: 'session-test', cwd: process.cwd() }).runId, s.runId);
  for (const patch of [
    { version: 2 },
    { sessionId: 'other' },
    { cwd: '/other' },
    { catalogHash: 'bad' },
    { step: 999 },
    { childCount: 1 },
    { signals: ['invalid'] },
  ])
    assert.throws(() =>
      restoreState(catalog, { ...s, ...patch }, { sessionId: 'session-test', cwd: process.cwd() }),
    );
});
test('bounded continuation stops with no checkpoint progress and has a hard run budget', () => {
  const w = fresh();
  assert.equal(w.nudge(), true);
  assert.equal(w.nudge(), false);
  assert.equal(w.state.status, 'paused');
  const another = fresh();
  another.state.autoTurns = 8;
  assert.equal(another.nudge(), false);
});
test('a check from an older epoch cannot verify changed content', () => {
  const w = fresh();
  until(w, 'VR03');
  w.observe({ id: 'old-check', tool: 'test', effect: 'check', ok: true });
  w.mutate('content');
  assert.throws(() => step(w, { evidence: ['old-check'] }), /当前 epoch/);
});
test('a change after VR03 forces recheck before VR06 can finalize verification', () => {
  const w = fresh();
  until(w, 'VR06');
  w.mutate('content');
  step(w);
  assert.equal(w.checkpoint.id, 'VR01');
  assert.equal(w.state.verified, undefined);
  until(w, 'VR06');
  step(w);
  assert.equal(w.checkpoint.id, 'DOC00');
  assert.ok(sameEpoch(w.state.verified, w.state.epoch));
});
test('completed history remains structurally restorable after pause or external change', () => {
  const w = fresh();
  until(w, 'DA05');
  step(w);
  w.mutate('git');
  w.pause('用户实际状态变化，旧验收不是当前证明');
  assert.equal(w.state.verified, undefined);
  assert.equal(w.state.status, 'complete');
  assert.equal(
    restoreState(catalog, w.snapshot(), { sessionId: 'session-test', cwd: process.cwd() }).status,
    'complete',
  );
});
test('default contexts remain bounded for both routes even with a full observation window', () => {
  for (const mode of ['single', 'multi'])
    for (const phase of PHASES) {
      const w = fresh(mode);
      w.state.phase = phase;
      for (let i = 0; i < 128; i++)
        w.observe({ id: `observation-${i}`, tool: 'synthetic-read', effect: 'read', ok: true });
      assert.ok(renderContext(w).length < MAX_CONTEXT, `${mode}/${phase}`);
    }
});
test('completed state rejects semantic signal mutation', () => {
  const w = fresh();
  until(w, 'DA05');
  step(w);
  const before = w.snapshot();
  assert.throws(
    () =>
      w.signal(w.state.revision, { signal: 'requirements_changed', evidence: ['user-1'], reason: '新任务' }),
    /终态/,
  );
  assert.deepEqual(w.snapshot(), before);
});
