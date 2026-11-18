#!/usr/bin/env node
// Explicit opt-in local integration smoke. No actual Pi/model/MCP process is started.
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
const host = process.argv[2] ?? process.env.PI_EXTENSION_HOST_ROOT;
const entry = process.argv[3];
assert.ok(host && entry, '传入已有Pi包根目录与获准的现有subagent/index.ts；不自动查找或安装');
const root = resolve(host),
  nativeEntry = resolve(entry),
  nativeDir = dirname(nativeEntry);
assert.equal(
  JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name,
  '@earendil-works/pi-coding-agent',
);
const requireHost = createRequire(join(root, 'package.json'));
const aliases = {
  '@earendil-works/pi-coding-agent': join(root, 'dist/index.js'),
  typebox: requireHost.resolve('typebox'),
};
for (const name of ['pi-ai', 'pi-agent-core', 'pi-tui'])
  aliases[`@earendil-works/${name}`] = join(root, 'node_modules/@earendil-works', name, 'dist/index.js');
for (const value of Object.values(aliases)) assert.ok(existsSync(value), value);
const temp = mkdtempSync(join(tmpdir(), 'pi-subagent-smoke-'));
const originalSpawn = childProcess.spawn;
try {
  // Only compare approved deployment resources, never auth/settings/model configuration.
  const agentDir = resolve(nativeDir, '../../agents');
  const names = ['worker', 'reviewer', 'scout', 'planner', 'git-operator'];
  for (const name of names)
    assert.equal(
      readFileSync(join(project, 'agents', `${name}.md`), 'utf8'),
      readFileSync(join(agentDir, `${name}.md`), 'utf8'),
      `${name} deployment drift`,
    );
  assert.equal(
    readFileSync(join(project, 'extensions/coding-workflow/model-selection.ts'), 'utf8'),
    readFileSync(join(nativeDir, 'model-selection.ts'), 'utf8'),
  );
  const paths = Object.fromEntries(
    Object.entries(aliases).map(([name, path]) => [
      name,
      [path.replace(/\.mjs$/, '.d.mts').replace(/\.js$/, '.d.ts')],
    ]),
  );
  writeFileSync(
    join(temp, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2023',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        allowImportingTsExtensions: true,
        types: ['node'],
        typeRoots: [join(root, 'node_modules/@types')],
        paths,
      },
      include: [nativeEntry, join(nativeDir, 'agents.ts'), join(nativeDir, 'model-selection.ts')],
    }),
  );
  const typed = childProcess.spawnSync(process.env.TSC_BIN ?? 'tsc', ['-p', join(temp, 'tsconfig.json')], {
    encoding: 'utf8',
  });
  assert.equal(typed.status, 0, typed.stdout + typed.stderr);

  const spawns = [];
  childProcess.spawn = (_command, args) => {
    // This function never launches an executable, shell or network client.
    spawns.push([...args]);
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = () => true;
    queueMicrotask(() => {
      const requested = args[args.indexOf('--model') + 1].replace(
        /:(off|minimal|low|medium|high|xhigh|max)$/,
        '',
      );
      const at = requested.indexOf('/');
      const message = {
        role: 'assistant',
        provider: requested.slice(0, at),
        model: requested.slice(at + 1) + '-synthetic-host',
        content: [{ type: 'text', text: 'synthetic complete task evidence' }],
        stopReason: 'end',
      };
      proc.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'message_end', message }) + '\n'));
      proc.emit('close', 0);
    });
    return proc;
  };
  syncBuiltinESMExports();
  const { createJiti } = requireHost('jiti');
  const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false, alias: aliases });
  const sdk = await jiti.import(aliases['@earendil-works/pi-coding-agent']);
  for (const name of names) {
    const { frontmatter, body } = sdk.parseFrontmatter(readFileSync(join(agentDir, `${name}.md`), 'utf8'));
    assert.equal(frontmatter.name, name);
    assert.equal(frontmatter.model, undefined);
    assert.ok(frontmatter.description.length > 20 && body.includes('禁止Computer Use'));
  }
  const factory = await jiti.import(nativeEntry, { default: true });
  let tool;
  factory({
    registerTool: (value) => {
      tool = value;
    },
  });
  assert.equal(tool.name, 'subagent');
  assert.equal(tool.parameters.properties.model.type, 'string');
  for (const list of ['tasks', 'chain'])
    assert.equal(tool.parameters.properties[list].items.properties.model.type, 'string');
  const models = ['gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-luna'].map((id) => ({
    id,
    provider: 'openai',
    name: id,
    api: 'openai-responses',
    reasoning: true,
    input: ['text', 'image'],
    thinkingLevelMap: {
      ...(id.endsWith('sol') ? {} : { off: 'none' }),
      low: 'low',
      medium: 'medium',
      high: 'high',
      xhigh: 'xhigh',
      max: 'max',
    },
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1050000,
    maxTokens: 128000,
  }));
  const ctx = {
    cwd: temp,
    model: { provider: 'openai', id: 'gpt-6-luna' },
    thinkingLevel: 'max',
    hasUI: false,
    modelRegistry: { getAvailable: () => models },
  };
  const run = (params) => tool.execute('synthetic-smoke', params, undefined, undefined, ctx);
  const selected = (value) => value.slice(value.indexOf('--model') + 1, value.indexOf('--model') + 2)[0];
  const single = await run({ agent: 'worker', task: 'synthetic no-op', model: 'openai/gpt-6.1-sol:medium' });
  assert.ok(!single.isError, JSON.stringify(single));
  assert.equal(selected(spawns.at(-1)), 'openai/gpt-6.1-sol:medium');
  assert.ok(!spawns.at(-1).includes('--thinking'), 'parent thinking must not override explicit suffix');
  assert.equal(single.details.results[0].requestedModel, 'openai/gpt-6.1-sol:medium');
  assert.equal(single.details.results[0].model, 'openai/gpt-6.1-sol-synthetic-host');
  const parallel = await run({
    model: 'openai/gpt-6-luna:low',
    tasks: [
      { agent: 'worker', task: 'a' },
      { agent: 'scout', task: 'b', model: 'openai/gpt-6.1-terra:high' },
    ],
  });
  assert.ok(!parallel.isError);
  assert.deepEqual(
    parallel.details.results.map((r) => r.requestedModel),
    ['openai/gpt-6-luna:low', 'openai/gpt-6.1-terra:high'],
  );
  assert.deepEqual(
    spawns.slice(-2).map(selected).sort(),
    ['openai/gpt-6-luna:low', 'openai/gpt-6.1-terra:high'].sort(),
  );
  await run({
    model: 'openai/gpt-6-luna:medium',
    chain: [
      { agent: 'worker', task: 'a', model: 'openai/gpt-6.1-sol:high' },
      { agent: 'scout', task: '{previous}' },
    ],
  });
  assert.deepEqual(spawns.slice(-2).map(selected), ['openai/gpt-6.1-sol:high', 'openai/gpt-6-luna:medium']);
  await run({ agent: 'worker', task: 'inherit' });
  assert.equal(selected(spawns.at(-1)), 'openai/gpt-6-luna');
  assert.deepEqual(
    spawns.at(-1).slice(spawns.at(-1).indexOf('--thinking'), spawns.at(-1).indexOf('--thinking') + 2),
    ['--thinking', 'max'],
  );
  for (const params of [
    { agent: 'worker', task: 'bad', model: 'luna' },
    { agent: 'worker', task: 'bad', model: 'openai/missing:low' },
    { agent: 'worker', task: 'bad', model: 'openai/gpt-6.1-sol:off' },
    {
      chain: [
        { agent: 'worker', task: 'a' },
        { agent: 'scout', task: 'b', model: 'openai/missing:low' },
      ],
    },
    {
      tasks: [
        { agent: 'worker', task: 'a' },
        { agent: 'scout', task: 'b', model: 'openai/gpt-6-luna:minimal' },
      ],
    },
  ]) {
    const before = spawns.length,
      result = await run(params);
    assert.equal(result.isError, true, JSON.stringify({ params, result }));
    assert.equal(spawns.length, before, 'bad selection must reject the whole batch before spawn');
  }
  assert.deepEqual(ctx.model, { provider: 'openai', id: 'gpt-6-luna' });
  assert.equal(ctx.thinkingLevel, 'max');
  console.log(
    '现有子代理：5份部署描述、类型/Schema、单任务/parallel/chain CLI选型与继承、全批前置拒绝检查通过（模拟spawn，无真实Pi/模型/MCP进程）。',
  );
} finally {
  childProcess.spawn = originalSpawn;
  syncBuiltinESMExports();
  rmSync(temp, { recursive: true, force: true });
}
