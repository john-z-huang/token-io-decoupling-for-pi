import assert from 'node:assert/strict';
import { loadCatalog } from '../extensions/coding-workflow/catalog.ts';
import { makeState, Workflow } from '../extensions/coding-workflow/engine.ts';

export const catalog = loadCatalog();
export function fresh(mode = 'single', count = mode === 'single' ? 0 : 1) {
  const w = new Workflow(
    catalog,
    makeState(
      catalog,
      { sessionId: 'session-test', cwd: process.cwd() },
      { mode, childCount: count, task: '合成测试任务；用户明确禁止持久化计划' },
    ),
  );
  w.state.audit = {
    audit_mode: 'balanced',
    root_reasoning_cadence: 'milestone_only',
    worker_reasoning_cadence: 'full',
    source: { audit_mode: 'default', root_reasoning_cadence: 'default', worker_reasoning_cadence: 'default' },
  };
  w.observe({ id: 'user-1', tool: '/coding', effect: 'user', ok: true });
  return w;
}
export function report(w, overrides = {}) {
  const id = w.checkpoint.id;
  const facts = {
    ER01: { independence: 'not_required' },
    WD03: { plan: 'prohibited' },
    DE02: { executor: 'sub_agent' },
    VR03: { verification: 'passed' },
    DA03: { acceptance: 'satisfied' },
  }[id];
  return {
    checkpoint: id,
    outcome: 'complete',
    summary: '合成证据摘要，非真实项目验收',
    evidence:
      id === 'VR03'
        ? [w.state.observations.filter((o) => o.effect === 'check').at(-1)?.id ?? 'user-1']
        : ['user-1'],
    facts,
    ...overrides,
  };
}
export function step(w, overrides) {
  w.report(w.state.revision, [report(w, overrides)]);
}
export function until(w, checkpoint) {
  let budget = 100;
  while (w.checkpoint?.id !== checkpoint && budget--) {
    if (w.checkpoint?.id === 'DE04' && !w.state.slice) w.release(w.state.revision, slice);
    if (w.checkpoint?.id === 'VR03')
      w.observe({
        id: w.state.observations.some((o) => o.id === 'check-1') ? `check-${w.state.revision}` : 'check-1',
        tool: 'synthetic-test',
        effect: 'check',
        ok: true,
      });
    step(w);
  }
  assert.ok(budget > 0, `未到达 ${checkpoint}`);
}
export const slice = {
  objective: '已授权的合成输出',
  paths: ['example.ts'],
  mutations: ['content'],
  returnConditions: '产物及检查证据返回',
  unreleased: 'Git、网络和扩容',
  evidence: ['user-1'],
};
