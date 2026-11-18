#!/usr/bin/env node
import assert from 'node:assert/strict';
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { documentLinks, loadCatalog, PHASES, HOOK_IDS, resolveDocumentLink, SIGNALS } from '../extensions/coding-workflow/catalog.ts';
import { makeState, Workflow } from '../extensions/coding-workflow/engine.ts';
import { MAX_CONTEXT, renderContext } from '../extensions/coding-workflow/runtime.ts';
import { collectSourceCoverage, coverageMarkdown, coverageYaml, headingAnchors, readHookSources, validateMarkdownLinks } from './pi-hook-validation.mjs';

const c = loadCatalog();
let links = 0, largestDefault = 0, largestConditional = 0, contexts = 0;
const hooks = readHookSources(c.root);
for (const id of HOOK_IDS) links += validateMarkdownLinks(c.root, `hooks/${id}.md`, hooks[id]);
for (const path of c.references.documentPaths()) {
  if (path.startsWith('hooks/')) continue;
  const body = readFileSync(join(c.root, path), 'utf8');
  links += validateMarkdownLinks(c.root, path, body);
  const anchors = headingAnchors(body);
  for (const fragment of c.references.documentForPath(path).fragments) {
    if (fragment.kind === 'section') assert.ok(anchors.has(fragment.anchor), `${path}: 导出缺少片段 ${fragment.id} 的标题锚点`);
  }
  for (const target of documentLinks(body)) {
    const link = resolveDocumentLink(c.root, path, target);
    if (path.startsWith('references/')) {
      assert.ok(!link?.path.startsWith(join(c.root, 'hooks') + sep), `${path}: 底层规则不能反向依赖 Hook ${target}`);
    }
  }
}
const rows = collectSourceCoverage(c, hooks);
const coverageOutputs = [
  [join(c.root, 'hooks/SOURCE_COVERAGE.md'), coverageMarkdown(rows)],
  [join(c.root, '../rules/hooks/SOURCE_COVERAGE.yaml'), coverageYaml(rows)],
];
for (const [path, generated] of coverageOutputs) {
  assert.equal(realpathSync(dirname(path)), dirname(path), `${path}: 来源对照目录不得经过符号链接`);
  assert.ok(!lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink(), `${path}: 来源对照不得是符号链接`);
  if (process.argv.includes('--write-coverage')) writeFileSync(path, generated);
  assert.equal(readFileSync(path, 'utf8'), generated,
    `${path}: 来源对照表过期，请运行 node scripts/check-pi-hooks.mjs --write-coverage 并审阅变化`);
}
for (const name of ['README', 'SOURCE_COVERAGE']) links += validateMarkdownLinks(c.root, `hooks/${name}.md`, readFileSync(join(c.root, `hooks/${name}.md`), 'utf8'));
for (const mode of ['single', 'multi']) for (const phase of PHASES) {
  for (const signals of [[], ...SIGNALS.map(signal => [signal]), [...SIGNALS]]) for (const status of ['active', 'paused']) {
    const state = makeState(c, 'hook-check', process.cwd(), mode, mode === 'single' ? 0 : 1, '有界合成任务');
    state.phase = phase; state.signals = signals; state.status = status;
    const length = renderContext(new Workflow(c, state)).length;
    if (!signals.length && status === 'active') largestDefault = Math.max(largestDefault, length);
    largestConditional = Math.max(largestConditional, length); contexts++;
  }
}
assert.equal(new Set(rows.map(row => row.path)).size, rows.length);
const counts = Object.fromEntries(['rule', 'navigation', 'reference'].map(kind => [kind, rows.filter(row => row.kind === kind).length]));
console.log(JSON.stringify({ hooks: HOOK_IDS.length, sources: rows.length, counts, explicitArticleCoverage: rows.filter(row => row.kind !== 'navigation' && row.hooks.length).length, checkedLocalLinks: links, contexts, maxDefaultContextCharacters: largestDefault, maxConditionalContextCharacters: largestConditional, contextLimit: MAX_CONTEXT, catalogHash: c.digest, note: '全文执行条款注入；逐篇来源表驻盘。链接、锚点和显式归属检查不证明所有条款语义等价、权限真实或端到端验收。外部URL未联网验证。' }, null, 2));
