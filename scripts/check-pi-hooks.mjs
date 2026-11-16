#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, realpathSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { loadCatalog, PHASES, HOOK_IDS, SKILL_ROOT, resolveHookLink } from '../extensions/coding-workflow/catalog.ts';
import { makeState, Workflow } from '../extensions/coding-workflow/engine.ts';
import { renderContext } from '../extensions/coding-workflow/runtime.ts';
const c = loadCatalog();
let links = 0, largest = 0;
for (const id of HOOK_IDS) {
  const hook = c.hooks[id];
  for (const match of hook.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^[a-z]+:/i.test(target) || target.startsWith('#')) continue;
    const path = resolveHookLink(SKILL_ROOT, id, target);
    assert.ok(existsSync(path), `${id}: 不存在 ${target}`);
    assert.ok(!relative(realpathSync(SKILL_ROOT), realpathSync(path)).startsWith('..' + sep), `${id}: 来源超出 Skill`);
    links++;
  }
}
for (const mode of ['single', 'multi']) for (const phase of PHASES) {
  const state = makeState(c, 'hook-check', process.cwd(), mode, mode === 'single' ? 0 : 1, '有界合成任务');
  state.phase = phase;
  const w = new Workflow(c, state); largest = Math.max(largest, renderContext(w).length);
}
assert.equal(new Set(c.coverage.map(row => row.path)).size, c.coverage.length);
const counts = Object.fromEntries(['rule', 'navigation', 'reference'].map(kind => [kind, c.coverage.filter(row => row.kind === kind).length]));
console.log(JSON.stringify({ hooks: HOOK_IDS.length, sources: c.coverage.length, counts, sourceLinks: links, maxDefaultContextCharacters: largest, catalogHash: c.digest, note: '结构、路径归属及预算检查，不证明压缩合同与所有 owner 语义等价；owner 仍保留为详细权威。' }, null, 2));
