// Shared, offline checks for the repository's inline/reference Markdown links and provenance tables.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { documentLinks, headingSlug, HOOK_IDS, PHASES, phaseHooks, resolveDocumentLink } from '../extensions/coding-workflow/catalog.ts';

const L1_HOOKS = {
  'context-exchange': ['context'], delegation: ['delegation', 'session'],
  'execution-control': ['execution'], 'execution-planning': ['planning'],
  'session-runtime': ['session', 'audit'], 'workflow-navigation': ['navigation'],
};
const L2_HOOKS = {
  'entry-and-context': ['entry', 'planning'], 'decision-and-execution': ['execution', 'planning'],
  'verification-and-repair': ['verification', 'repair'], 'completion-and-effects': ['documentation', 'delivery'],
};
const OVERRIDES = {
  'candidate-compliance': ['materialization'], 'output-materialization': ['materialization'],
  'decisions-advisory': ['advisory'], 'decision-context-generation': ['advisory', 'planning'],
  'workflow-routing-advice': ['navigation', 'advisory'], 'workflow-module-contract': ['recovery'],
  'LSP-MCP-Tools': ['context', 'session'], 'runtime-provider-support': ['foundation', 'session', 'delegation'],
  'session-context-firewall': ['context'], 'reasoning-summary-visibility': ['audit'], 'session-audit-visibility': ['audit'],
};

export function classifySource(catalog, path) {
  const parts = path.split('/');
  const stem = parts.at(-1).replace(/\.md$/, '');
  const kind = ['INDEX', 'README'].includes(stem) ? 'navigation' : 'rule';
  if (parts.includes('multimodal')) return { path, hooks: ['foundation'], kind: 'reference' };
  if (Object.hasOwn(OVERRIDES, stem)) return { path, hooks: OVERRIDES[stem], kind };
  if (parts.includes('share') || path === 'SKILL.md') return { path, hooks: ['foundation'], kind };
  const layer = parts.findIndex(part => part.startsWith('layer-'));
  if (layer >= 0) {
    const number = parts[layer].slice(6, 8);
    const group = parts[layer + 1];
    if (number === '01' || number === '02') {
      if (!group || group.endsWith('.md')) return { path, hooks: ['navigation'], kind };
      const table = number === '01' ? L1_HOOKS : L2_HOOKS;
      if (Object.hasOwn(table, group)) return { path, hooks: table[group], kind };
    }
    if (number === '03') return { path, hooks: ['navigation', 'execution'], kind };
    if (number === '04') {
      const phase = PHASES.find(item => ['single', 'multi'].some(mode => catalog.routes[mode].steps[item].module === stem));
      return { path, hooks: phase ? phaseHooks(phase, 'multi') : ['navigation'], kind };
    }
  }
  if (path === 'PI_EXTENSION.md') return { path, hooks: ['foundation', 'navigation'], kind: 'navigation' };
  if (path === 'workflows/coding.md' || path === 'WORKFLOW_ARCHITECTURE.md') return { path, hooks: ['foundation', 'navigation'], kind };
  throw new Error(`没有 Hook 归属的规则：${path}`);
}

function markdownFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    assert.ok(!entry.isSymbolicLink(), `规则源不允许符号链接：${entry.name}`);
    const path = join(root, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith('.md') ? [path] : [];
  }).sort();
}

export function readHookSources(root) {
  return Object.fromEntries(HOOK_IDS.map(id => [id, readFileSync(join(root, 'hooks', `${id}.md`), 'utf8')]));
}

export function headingAnchors(markdown) {
  const anchors = new Set(), counts = new Map();
  let fence;
  for (const line of markdown.split('\n')) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) { if (marker?.[1][0] === fence[0] && marker[1].length >= fence.length && !line.slice(marker[0].length).trim()) fence = undefined; continue; }
    if (marker) { fence = marker[1]; continue; }
    for (const match of line.matchAll(/<(?:a|h[1-6])\b[^>]*\b(?:id|name)=["']([^"']+)["']/gi)) anchors.add(match[1]);
    const heading = line.match(/^ {0,3}#{1,6}\s+(.+?)(?:\s+#+\s*)?$/);
    if (!heading) continue;
    const base = headingSlug(heading[1]);
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1); anchors.add(n ? `${base}-${n}` : base);
  }
  return anchors;
}

export function validateMarkdownLinks(root, document, markdown) {
  let checked = 0;
  for (const target of documentLinks(markdown)) {
    assert.ok(!/^file:/i.test(target), `${document}: 磁盘文档不得写入机器专属 file URL`);
    const link = resolveDocumentLink(root, document, target);
    if (!link) continue; // External URLs are not fetched or represented as online-verified.
    assert.ok(existsSync(link.path) && statSync(link.path).isFile(), `${document}: 链接目标不存在或不是文件 ${target}`);
    const rel = relative(realpathSync(root), realpathSync(link.path));
    assert.ok(rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel), `${document}: 来源通过符号链接越出 Skill ${target}`);
    if (link.fragment) assert.ok(headingAnchors(readFileSync(link.path, 'utf8')).has(link.fragment), `${document}: 标题锚点不存在 ${target}`);
    checked++;
  }
  return checked;
}

export function collectSourceCoverage(catalog, hooks = readHookSources(catalog.root)) {
  const coverage = markdownFiles(catalog.root).map(path => relative(catalog.root, path).split(sep).join('/'))
    .filter(path => !path.startsWith('hooks/')).map(path => classifySource(catalog, path));
  const bySource = new Map(coverage.map(row => [row.path, new Set()]));
  for (const id of HOOK_IDS) {
    const text = hooks[id];
    assert.ok(!text.includes('\0'), `${id}: Markdown中不得嵌入NUL字节`);
    const names = ['触发条件', '执行要求', '退出与阻断', '重新核验', '规则来源'];
    const positions = names.map(name => text.indexOf(`\n## ${name}\n`));
    assert.ok(positions.every((p, i) => p >= 0 && (!i || p > positions[i - 1])), `${id}: 合同章节缺失或次序错误`);
    const footer = text.slice(positions.at(-1) + '\n## 规则来源\n'.length).trim();
    assert.ok(footer.split('\n').filter(line => line.trim()).every(line => line.startsWith('|')), `${id}: 规则来源只放非执行性对照表，动作条款须置于执行/退出/重核章节`);
    assert.ok(/^\|\s*来源\s*\|\s*本合同落点\s*\|/m.test(footer), `${id}: 缺少逐篇来源与合同落点表`);
    let referenced = 0;
    for (const target of documentLinks(footer)) {
      const link = resolveDocumentLink(catalog.root, `hooks/${id}.md`, target);
      if (!link) continue;
      const source = relative(catalog.root, link.path).split(sep).join('/');
      if (bySource.has(source)) { bySource.get(source).add(id); referenced++; }
    }
    assert.ok(referenced > 0, `${id}: 没有真实规则来源`);
  }
  const missing = coverage.filter(row => row.kind !== 'navigation' && !bySource.get(row.path).size);
  assert.deepEqual(missing.map(row => row.path), [], '实质规则/参考文章缺少逐篇合同落点');
  return coverage.map(row => ({ ...row, hooks: [...bySource.get(row.path)], declaredHooks: row.hooks }));
}

export function coverageMarkdown(rows) {
  const lines = [
    '# Hook 来源整合对照', '',
    '由 `node scripts/check-pi-hooks.mjs --write-coverage` 根据各 Hook 的“规则来源”表生成；默认检查只读。', '',
    '实质文章逐篇指向实际引用它的执行合同；各合同末尾列明具体主题落点。目录/索引未逐篇引用时只保留导航归属，不把目录计作已整合的实质指令。Multimodal 两篇仅作范围参考，不启用可执行路线。', '',
    '**此表检查路径和显式归属，不证明所有条款语义等价、授权真实或验收通过。** 原 owner 保留权威；阅读正文和逐条审阅不能由数量、Hash或关键词替代。', '',
    '| 源文档（相对 Skill） | 类型 | 合同落点或导航归属 |', '| --- | --- | --- |',
  ];
  for (const row of rows) {
    const ids = row.hooks.length ? row.hooks : row.declaredHooks;
    const label = row.kind === 'navigation' && !row.hooks.length ? '仅导航：' : row.kind === 'reference' ? '仅参考：' : '';
    lines.push(`| [${row.path}](../${row.path}) | ${row.kind} | ${label}${ids.map(id => `[${id}](${id}.md#执行要求)`).join('、')} |`);
  }
  return lines.join('\n') + '\n';
}
