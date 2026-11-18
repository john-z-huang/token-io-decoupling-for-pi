import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join, sep } from 'node:path';
import { test } from 'node:test';
import { loadCatalog } from '../extensions/coding-workflow/catalog.ts';
import { makeState, Workflow } from '../extensions/coding-workflow/engine.ts';
import { renderContext } from '../extensions/coding-workflow/runtime.ts';
import { SKILL_ROOT } from '../scripts/pi-hook-validation.mjs';

function interceptReads(t, observe) {
  const read = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (path, ...args) => observe(path, read(path, ...args)));
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
}

function patchSource(t, { file, before, after }) {
  interceptReads(t, (path, content) => {
    if (typeof path !== 'string' || !path.endsWith(file)) return content;
    return Buffer.from(content.toString('utf8').replace(before, after));
  });
}

function syntheticWorkflow(catalog, mode = 'single') {
  return new Workflow(
    catalog,
    makeState(
      catalog,
      { sessionId: 'dsl-test', cwd: process.cwd() },
      { mode, childCount: mode === 'single' ? 0 : 1, task: '合成任务' },
    ),
  );
}

function relativeReads(root, files) {
  const prefix = root + sep;
  return files
    .filter((file) => file.startsWith(prefix))
    .map((file) => file.slice(prefix.length))
    .sort();
}

const readScenarios = [
  {
    mode: 'single',
    phase: 'entry',
    step: 3,
    route: 'SM01',
    document: 'hook-entry',
    checkpoint: 'ER03',
    hooks: ['foundation', 'entry', 'navigation'],
    include: 'coding-single-agent',
  },
  {
    mode: 'multi',
    phase: 'entry',
    step: 3,
    route: 'MM01',
    document: 'hook-entry',
    checkpoint: 'ER03',
    hooks: ['foundation', 'entry', 'navigation'],
    include: 'coding-multi-agent',
  },
  {
    mode: 'single',
    phase: 'execution',
    step: 3,
    route: 'SM04',
    document: 'hook-execution',
    checkpoint: 'SE03',
    hooks: ['foundation', 'execution', 'planning'],
  },
  {
    mode: 'multi',
    phase: 'execution',
    step: 4,
    route: 'MM04',
    document: 'hook-delegation',
    checkpoint: 'DE04',
    hooks: ['foundation', 'execution', 'delegation', 'planning', 'context', 'audit'],
  },
  {
    mode: 'single',
    phase: 'verification',
    step: 3,
    route: 'SM05',
    document: 'hook-verification',
    checkpoint: 'VR03',
    hooks: ['foundation', 'verification', 'planning'],
    include: 'verification-epoch',
  },
];

function expectSelectedReads(files, scenario) {
  files.length = 0;
  const { mode, phase, step, route, document, checkpoint, hooks, include } = scenario;
  const catalog = loadCatalog();
  const references = catalog.references;
  const allSources = [...references.documentPaths()].map((path) => references.sourceForPath(path));
  assert.deepEqual(relativeReads(catalog.root, files), allSources.sort());

  files.length = 0;
  const workflow = syntheticWorkflow(catalog, mode);
  Object.assign(workflow.state, { phase, step });
  const context = renderContext(workflow);
  assert.ok(context.includes(`当前路线 [${route} `));
  assert.ok(context.includes(`当前检查点 [${checkpoint} `));
  if (checkpoint === 'VR03') assert.ok(context.includes('VR04 分类并报告证据。'));
  const expected = new Set(hooks.map((id) => `hooks/${id}.yaml`));
  for (const id of [`coding-${mode}-agent`, document, include].filter(Boolean)) {
    expected.add(references.sourceForPath(references.document(id).path));
  }
  assert.deepEqual(relativeReads(catalog.root, files), [...expected].sort());
  assert.ok(
    files.every((file) => !file.startsWith(SKILL_ROOT + sep)),
    'runtime never reads generated Skill',
  );
}

test('the catalog reads only selected Hooks, route rules, and current checkpoint bodies', (t) => {
  const files = [];
  interceptReads(t, (path, content) => {
    if (typeof path === 'string') files.push(path);
    return content;
  });
  for (const scenario of readScenarios) expectSelectedReads(files, scenario);
});

test('the catalog rejects invalid route and Hook guard bindings', async (t) => {
  await t.test('single route cannot bind a delegation Hook', (check) => {
    patchSource(check, {
      file: 'coding-single-agent.yaml',
      before: /hook: execution([\s\S]*?)\]\(\.\.\/hooks\/execution\.yaml\)/,
      after: 'hook: delegation$1](../hooks/delegation.yaml)',
    });
    assert.throws(() => loadCatalog(), /路线契约变化/);
  });
  await t.test('required host anchor cannot be removed', (check) => {
    patchSource(check, { file: 'hooks/entry.yaml', before: '- ER01:', after: '- ER99:' });
    assert.throws(() => loadCatalog(), /检查点契约变化/);
  });
  await t.test('unknown activation is rejected', (check) => {
    patchSource(check, {
      file: 'hooks/advisory.yaml',
      before: '[advice_requested]',
      after: '[unknown_signal]',
    });
    assert.throws(() => loadCatalog(), /activate_on/);
  });
});

test('a checkpoint’s optional applicability is read from YAML', (t) => {
  patchSource(t, {
    file: 'hooks/entry.yaml',
    before: '- ER00:\n            kind: checkpoint',
    after: '- ER99:\n            kind: checkpoint\n            applicability: optional',
  });
  const workflow = syntheticWorkflow(loadCatalog());
  workflow.observe({ id: 'user', tool: '/coding', effect: 'user', ok: true });
  assert.equal(workflow.checkpoint.id, 'ER99');
  workflow.report(workflow.state.revision, [
    {
      checkpoint: 'ER99',
      outcome: 'not_applicable',
      summary: '验证 Hook 中的适用条件',
      evidence: ['user'],
    },
  ]);
  assert.equal(workflow.checkpoint.id, 'ER01');
});

test('additional Hook activation is read from YAML', (t) => {
  patchSource(t, { file: 'hooks/advisory.yaml', before: '[advice_requested]', after: '[context_exchange]' });
  const workflow = syntheticWorkflow(loadCatalog());
  workflow.observe({ id: 'user', tool: '/coding', effect: 'user', ok: true });
  workflow.signal(workflow.state.revision, {
    signal: 'context_exchange',
    evidence: ['user'],
    reason: '验证 Hook 中的触发条件',
  });
  assert.ok(renderContext(workflow).includes('[Hook:advisory]'));
});

test('a changed YAML source fails the digest check before its checkpoint is used', (t) => {
  const workflow = syntheticWorkflow(loadCatalog());
  interceptReads(t, (path, content) =>
    typeof path === 'string' && path.endsWith(join('hooks', 'verification.yaml'))
      ? Buffer.from('篡改的指令')
      : content,
  );
  workflow.state.phase = 'verification';
  workflow.state.step = 3;
  assert.throws(() => renderContext(workflow), /Hash 不匹配：hooks\/verification.yaml/);
});
