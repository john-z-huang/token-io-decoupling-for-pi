import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { parseModelSelection, validateChildSelection, dispatchModelArgs } from '../extensions/coding-workflow/model-selection.ts';
const cards = JSON.parse(readFileSync(new URL('../integrations/pi-subagent/model-cards.json', import.meta.url), 'utf8'));
for (const card of cards.models) for (const effort of card.reasoningEffort) test(`${card.id}:${effort} is selectable as a configuration request, not identity proof`, () => {
  const level = effort === 'none' ? 'off' : effort, value = `openai/${card.id}:${level}`;
  assert.doesNotThrow(() => validateChildSelection(value));
  assert.deepEqual(parseModelSelection(value), { provider: 'openai', id: card.id, thinking: level });
});
test('unsupported card levels, fuzzy patterns, missing provider, credentials and unrelated families fail', () => {
  for (const value of ['luna', 'openai/gpt-6-luna', 'openai/gpt-6-luna:none', 'openai/gpt-6-luna:minimal', 'openai/gpt-6.1-sol:off', 'openai/*:high', 'openai/gpt-other:low', 'https://key@example.invalid/gpt-6-luna:low', 'openai/../gpt-6-luna:low']) assert.throws(() => validateChildSelection(value), value);
  assert.doesNotThrow(() => validateChildSelection('openrouter/openai/gpt-6.1-terra:medium'));
});
test('request beats fixed profile and parent; no request preserves old explicit-profile/inherited behavior', () => {
  const parent = { model: 'openai/gpt-6-luna', thinkingLevel: 'max' }, profile = 'openai/gpt-6-luna:low';
  assert.deepEqual(dispatchModelArgs('openai/gpt-6.1-sol:medium', profile, parent), { model: 'openai/gpt-6.1-sol:medium', args: ['--model', 'openai/gpt-6.1-sol:medium'] });
  assert.deepEqual(dispatchModelArgs(undefined, profile, parent).args, ['--model', profile]);
  assert.deepEqual(dispatchModelArgs(undefined, undefined, parent).args, ['--model', parent.model, '--thinking', 'max']);
  assert.deepEqual(parent, { model: 'openai/gpt-6-luna', thinkingLevel: 'max' });
  assert.deepEqual(dispatchModelArgs(undefined, undefined, {}).args, []);
});
test('all five Chinese profiles remove fixed model and retain Root/role/effect/recursion boundaries', () => {
  for (const name of ['worker', 'reviewer', 'scout', 'planner', 'git-operator']) {
    const text = readFileSync(new URL(`../agents/${name}.md`, import.meta.url), 'utf8');
    assert.match(text, new RegExp(`name: ${name}\\n`)); assert.doesNotMatch(text.split('---')[1], /^model:/m);
    for (const guard of ['禁止Computer Use', '不创建/派发其他代理', 'Root亲自负责', '未知效果', '不是OS沙箱']) assert.ok(text.includes(guard), name + ': ' + guard);
  }
  assert.match(readFileSync(new URL('../agents/planner.md', import.meta.url), 'utf8'), /不是第五种职责/);
  assert.match(readFileSync(new URL('../agents/git-operator.md', import.meta.url), 'utf8'), /coding_delegate仍拒绝/);
});
