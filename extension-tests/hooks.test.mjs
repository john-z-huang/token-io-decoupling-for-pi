import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentLinks, HOOK_IDS, loadCatalog, PHASES, resolveDocumentLink, resolveHookLink, rewriteDocumentLinks, SIGNALS } from '../extensions/coding-workflow/catalog.ts';
import { makeState, Workflow } from '../extensions/coding-workflow/engine.ts';
import { MAX_CONTEXT, renderContext, renderHook } from '../extensions/coding-workflow/runtime.ts';
import { collectSourceCoverage, coverageMarkdown, headingAnchors, validateMarkdownLinks } from '../scripts/pi-hook-validation.mjs';
const catalog = loadCatalog();

for (const id of HOOK_IDS) test(`${id}: complete execution clauses and every portable source link survive injection`, () => {
  const document = `hooks/${id}.md`, source = catalog.hooks[id];
  assert.ok(validateMarkdownLinks(catalog.root, document, source) > 0);
  const body = source.slice(0, source.indexOf('\n## 规则来源\n')).trimEnd();
  const injected = renderHook(catalog, id);
  assert.equal(injected.slice(injected.indexOf('\n\n') + 2), rewriteDocumentLinks(catalog.root, document, body));
  for (const title of ['触发条件', '执行要求', '退出与阻断', '重新核验']) assert.ok(injected.includes(`\n## ${title}\n`));
  assert.ok(!injected.includes('| 来源 | 本合同落点 |'), 'only the non-executable provenance table is left on disk');
  for (const target of documentLinks(injected)) {
    assert.match(target, /^(?:file:|https?:|mailto:|\/\/)/i, `unbased injected link: ${target}`);
    if (target.startsWith('file:')) assert.ok(existsSync(fileURLToPath(new URL(target))));
  }
});

test('all substantive articles have explicit per-hook provenance and the checked-in map is current', () => {
  const rows = collectSourceCoverage(catalog);
  assert.ok(rows.filter(row => row.kind === 'rule').every(row => row.hooks.length));
  assert.equal(readFileSync(join(catalog.root, 'hooks/SOURCE_COVERAGE.md'), 'utf8'), coverageMarkdown(catalog));
  for (const name of ['README', 'SOURCE_COVERAGE']) validateMarkdownLinks(catalog.root, `hooks/${name}.md`, readFileSync(join(catalog.root, `hooks/${name}.md`), 'utf8'));
});

test('removing one unique source citation fails coverage rather than silently assigning by directory', () => {
  const row = collectSourceCoverage(catalog).find(row => row.kind === 'rule' && row.hooks.length === 1);
  assert.ok(row);
  const id = row.hooks[0];
  const changed = { ...catalog, hooks: { ...catalog.hooks, [id]: catalog.hooks[id].split('\n').filter(line => !line.includes(`](../${row.path})`)).join('\n') } };
  assert.throws(() => collectSourceCoverage(changed), /实质规则\/参考文章缺少逐篇合同落点/);
});

test('source tables reject off-table clauses and Markdown cannot contain binary NUL', () => {
  for (const suffix of ['\n必须执行隐藏动作\n', '\0']) {
    const changed = { ...catalog, hooks: { ...catalog.hooks, foundation: catalog.hooks.foundation + suffix } };
    assert.throws(() => collectSourceCoverage(changed), /非执行性对照表|NUL/);
  }
});

test('local destinations are document-relative, decoded, fragment-aware and independent of the target workspace', () => {
  const root = join(tmpdir(), 'synthetic skill 空格');
  const link = resolveDocumentLink(root, 'hooks/a.md', '../源%20文件.md?view=1#标题');
  assert.equal(link.path, join(root, '源 文件.md'));
  assert.equal(link.fragment, '标题');
  assert.equal(fileURLToPath(new URL(link.url)), link.path);
  assert.match(link.url, /%20/); assert.match(link.url, /\?view=1#/);
  assert.equal(resolveHookLink(root, 'foundation', '../SKILL.md#入口'), join(root, 'SKILL.md'));
  assert.equal(resolveDocumentLink(root, 'hooks/a.md', 'https://example.invalid/doc#x'), undefined);
  for (const href of ['../../escape.md', '%2e%2e/%2e%2e/escape.md', '../%00.md']) assert.throws(() => resolveDocumentLink(root, 'hooks/a.md', href), /越出/);
});

test('inline labels, destination titles, reference definitions and code examples are handled without altering prose', () => {
  const source = '[`名称`](../SKILL.md "标题")\n[引用]: <../SKILL.md#入口> "标题"\n`[不是链接](../missing.md)`\n```md\n[示例](../missing.md)\n```';
  assert.deepEqual(documentLinks(source), ['../SKILL.md', '../SKILL.md#入口']);
  const rendered = rewriteDocumentLinks(catalog.root, 'hooks/a.md', source);
  assert.ok(rendered.includes('[`名称`](file:'));
  assert.ok(rendered.includes(' "标题")'));
  assert.ok(rendered.includes('`[不是链接](../missing.md)`'));
  assert.ok(rendered.includes('[示例](../missing.md)'));
});

test('links fail on missing files, directories, bad anchors or symlink escapes; duplicate and Chinese headings work', t => {
  const root = mkdtempSync(join(tmpdir(), 'pi-hook-links-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'hooks'));
  writeFileSync(join(root, 'source.md'), '# 来源\n## 小节\n## 小节\n<a id="custom"></a>\n```\n## 假标题\n```\n');
  assert.ok(headingAnchors(readFileSync(join(root, 'source.md'), 'utf8')).has('小节-1'));
  assert.equal(validateMarkdownLinks(root, 'hooks/a.md', '[x](../source.md#小节-1) [y](../source.md#custom)'), 2);
  for (const href of ['../missing.md', '.', '../source.md#不存在']) assert.throws(() => validateMarkdownLinks(root, 'hooks/a.md', `[x](${href})`), /链接目标|标题锚点/);
  assert.throws(() => validateMarkdownLinks(root, 'hooks/a.md', '[x](file:///tmp/source.md)'), /机器专属/);
  symlinkSync(join(catalog.root, 'SKILL.md'), join(root, 'escaped.md'));
  assert.throws(() => validateMarkdownLinks(root, 'hooks/a.md', '[x](../escaped.md)'), /符号链接/);
});

test('both routes retain all relevant contracts for single and combined signals, pause and a full observation window', () => {
  let peak = 0;
  for (const mode of ['single', 'multi']) for (const phase of PHASES) for (const signals of [[], ...SIGNALS.map(s => [s]), [...SIGNALS]]) for (const status of ['active', 'paused']) {
    const state = makeState(catalog, 'hook-test', tmpdir(), mode, mode === 'single' ? 0 : 1, 'synthetic workspace, not the extension source directory');
    state.phase = phase; state.signals = signals; state.status = status;
    const w = new Workflow(catalog, state);
    for (let i = 0; i < 128; i++) w.observe(`read-${i}`, 'synthetic-read', 'read', true);
    const content = renderContext(w); peak = Math.max(peak, content.length);
    assert.ok(content.length <= MAX_CONTEXT);
    assert.ok(content.includes('[Hook:foundation]'));
    assert.ok(!documentLinks(content).some(target => target.startsWith('../')), 'module and hook links must not bind to the target project');
    if (status === 'paused') assert.ok(content.includes('[Hook:recovery]'));
    if (signals.includes('advice_requested')) assert.ok(content.includes('[Hook:advisory]'));
    if (signals.includes('materialization_requested')) assert.ok(content.includes('[Hook:materialization]'));
  }
  assert.ok(peak > 32000, 'expanded contracts really exercise the increased bounded budget');
});

test('oversized state still blocks instead of truncating any execution guard', () => {
  const state = makeState(catalog, 'oversize', tmpdir(), 'single', 0, 'synthetic');
  state.task = 'x'.repeat(MAX_CONTEXT);
  assert.throws(() => renderContext(new Workflow(catalog, state)), /超出96000字符上限.*不是截断守卫/);
});
