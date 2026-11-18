import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exactPath } from '../extensions/coding-workflow/engine.ts';
import { harness, releaseSlice } from './pi-runtime-fixture.mjs';

test('Git preflight uses actual check receipts and rejects stale content without a phase cursor', async () => {
  const host = harness();
  await host.start();
  await releaseSlice(host, { mutations: ['content', 'git'] });
  const verify = (evidence) =>
    host.invoke('coding_checkpoint', {
      action: 'verify',
      revision: host.w().state.revision,
      evidence,
    });
  assert.equal((await verify([host.userRef()])).isError, true);
  assert.equal((await host.run('bash', 'git')).isError, true);

  const firstCheck = await host.run('bash', 'check');
  assert.equal((await verify([firstCheck.toolCall.id])).isError, false);
  assert.equal((await host.invoke('write', { path: 'synthetic.ts' })).isError, false);
  assert.equal((await host.run('bash', 'git')).isError, true);
  assert.equal((await verify([firstCheck.toolCall.id])).isError, true);

  const freshCheck = await host.run('bash', 'check');
  assert.equal((await verify([freshCheck.toolCall.id])).isError, false);
  assert.equal((await host.run('bash', 'git')).isError, false);
  assert.equal(host.w().state.epoch.git, 1);
  assert.equal((await verify([freshCheck.toolCall.id])).isError, false);
  assert.equal('git' in host.w().state.verified, false);
});

test('the agent can close a task directly while unresolved effects prevent closure', async () => {
  const host = harness();
  await host.start();
  const finish = () =>
    host.invoke('coding_checkpoint', {
      action: 'finish',
      revision: host.w().state.revision,
    });
  host.w().state.inFlight.push('unresolved');
  assert.equal((await finish()).isError, true);
  host.w().state.inFlight.pop();
  assert.equal((await finish()).isError, false);
  assert.equal(host.w().state.status, 'complete');
  assert.equal((await host.invoke('write', { path: 'synthetic.ts' })).isError, true);
});

test('legacy snapshots retain allocations and pending effects but drop the old cursor and write scope', async () => {
  const host = harness();
  await host.start('multi 合成任务');
  const snapshot = host.entries.at(-1).data.state;
  Object.assign(snapshot, {
    version: 1,
    catalogHash: 'previous-rules',
    phase: 'execution',
    step: 4,
    inFlight: ['legacy-call'],
    allocations: [{ id: 'allocation', callId: 'legacy-call', role: 'Primary Output', status: 'running' }],
    slice: { paths: ['old.ts'] },
  });
  const restored = harness({ entries: host.entries });
  await restored.emit('session_start', { reason: 'resume' });
  assert.equal(restored.w().state.version, 2);
  assert.match(restored.w().state.recoveryHint, /execution\/4/);
  assert.equal('phase' in restored.w().state, false);
  assert.equal(restored.w().state.slice, undefined);
  assert.equal(restored.w().state.allocations[0].status, 'uncertain');
  assert.deepEqual(restored.w().state.inFlight, ['legacy-call']);
  assert.equal(restored.w().state.status, 'paused');
});

test('exact path guard rejects directories, traversal, metadata and globs', () => {
  for (const path of ['/root/file', 'dir/../file', './a', '.git/config', 'dir/', 'dir/*', '@alias']) {
    assert.equal(exactPath(path), false, path);
  }
  assert.equal(exactPath('dir/file.ts'), true);
});
