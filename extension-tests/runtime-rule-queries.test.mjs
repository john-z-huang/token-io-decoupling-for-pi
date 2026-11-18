import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { documentLinks, loadCatalog } from '../extensions/coding-workflow/catalog.ts';
import { atCheckpoint, catalog, harness } from './pi-runtime-fixture.mjs';

const routeHooks = [
  'entry',
  'session',
  'planning',
  'execution',
  'delegation',
  'verification',
  'documentation',
  'delivery',
];

async function readRule(host, request = {}) {
  const response = await host.invoke('coding_checkpoint', { action: 'rules', ...request });
  const content = response.result.content[0].text;
  assert.equal(response.isError, false, content);
  return JSON.parse(content);
}

async function verifyNavigation(host, root, before) {
  const navigation = [
    ['routes', ['coding-rule:coding-single-agent', 'coding-rule:coding-multi-agent']],
    ['section-01', routeHooks.map((id) => pathToFileURL(join(root, 'hooks', `${id}.yaml`)).href)],
  ];
  for (const [fragment, links] of navigation) {
    const document = 'layer-04-readme';
    const result = await readRule(host, { document, fragment });
    assert.equal(result.document, document);
    assert.equal(result.fragment, fragment);
    assert.deepEqual(documentLinks(result.content), links);
    assert.deepEqual(host.w().snapshot(), before.state);
    assert.deepEqual(host.entries, before.entries);
  }
}

async function verifyCurrentRule(host, { owner, checkpoint, legacyModule }, injected) {
  const index = await readRule(host);
  assert.equal(index.document, owner);
  assert.ok(
    index.fragments.some(
      (item) => item.id === checkpoint && item.kind === 'checkpoint' && !('content' in item),
    ),
  );
  const rule = await readRule(host, { fragment: checkpoint });
  assert.equal(rule.fragment, checkpoint);
  assert.ok(injected.includes(rule.content));
  const legacy = await readRule(host, { document: legacyModule, fragment: checkpoint });
  assert.deepEqual(legacy, rule);
}

async function verifySharedRules(host, mode) {
  const returns = await readRule(host, { document: `coding-${mode}-agent`, fragment: 'returns' });
  assert.match(returns.content, /原挂起.*子步骤/);
  const creation = await readRule(host, { document: 'delegation-child-creation', fragment: 'rules' });
  assert.match(creation.content, /coding-rule:runtime-provider-support#subagent-endpoint/);
  const endpoint = await readRule(host, {
    document: 'runtime-provider-support',
    fragment: 'subagent-endpoint',
  });
  assert.match(endpoint.content, /端点/);
}

test('both routes and rule queries work with the YAML sources alone', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pi-runtime-data-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(catalog.root, root, { recursive: true });
  assert.ok(!existsSync(join(root, 'coding-workflows', 'README.md')));
  const installed = loadCatalog(root);
  assert.equal(installed.digest, catalog.digest);

  const scenarios = [
    {
      mode: 'single',
      route: 'SM04',
      owner: 'hook-execution',
      legacyModule: 'single-execution',
      checkpoint: 'SE03',
    },
    {
      mode: 'multi',
      route: 'MM04',
      owner: 'hook-delegation',
      legacyModule: 'delegated-execution',
      checkpoint: 'DE04',
    },
  ];
  for (const scenario of scenarios) {
    const { mode, route, owner, checkpoint } = scenario;
    const host = harness({ catalog: installed });
    await host.start(`${mode} 合成规则请求`);
    atCheckpoint(host, { phase: 'execution', checkpoint });
    const [message] = (await host.emit('context', { messages: [] })).messages;
    assert.match(message.content, new RegExp(`coding-rule:coding-${mode}-agent#${route}`));
    assert.match(message.content, new RegExp(`coding-rule:${owner}#${checkpoint}`));
    const before = { state: host.w().snapshot(), entries: structuredClone(host.entries) };

    await verifyNavigation(host, root, before);
    await verifyCurrentRule(host, scenario, message.content);
    await verifySharedRules(host, mode);
    const invalid = await host.invoke('coding_checkpoint', {
      action: 'rules',
      document: '../references/unknown.md',
    });
    assert.equal(invalid.isError, true);
    assert.deepEqual(host.w().snapshot(), before.state);
    assert.deepEqual(host.entries, before.entries);
  }
});
