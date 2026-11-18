#!/usr/bin/env node
// Explicit opt-in local integration smoke. No actual Pi/model/MCP process is started.
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHostLoader, declarationPath, hostModulePaths, openPiHost } from './pi-installed-host.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const AGENT_PROFILES = ['worker', 'reviewer', 'scout', 'planner', 'git-operator'];

function checkDeployment(nativeDir, agentDir) {
  // 仅比较已授权的部署文件，差异报告只包含文件名。
  for (const name of AGENT_PROFILES) {
    const profile = `${name}.md`;
    assert.ok(
      readFileSync(join(project, 'agents', profile)).equals(readFileSync(join(agentDir, profile))),
      `${profile} deployment drift`,
    );
  }
  const source = readFileSync(join(project, 'extensions/coding-workflow/model-selection.ts'));
  assert.ok(
    source.equals(readFileSync(join(nativeDir, 'model-selection.ts'))),
    'model-selection.ts deployment drift',
  );
}

function checkTypes(temp, { hostRoot, aliases }, sourceFiles) {
  const paths = Object.fromEntries(
    Object.entries(aliases).map(([name, path]) => [name, [declarationPath(path)]]),
  );
  const configPath = join(temp, 'tsconfig.json');
  writeFileSync(
    configPath,
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
        typeRoots: [join(hostRoot, 'node_modules/@types')],
        paths,
      },
      include: sourceFiles,
    }),
  );
  const typed = childProcess.spawnSync(process.env.TSC_BIN ?? 'tsc', ['-p', configPath], {
    encoding: 'utf8',
  });
  if (typed.error) throw typed.error;
  assert.equal(typed.status, 0, typed.stdout + typed.stderr);
}

function modelArg(args) {
  return args[args.indexOf('--model') + 1];
}

function captureSpawns() {
  // 由模拟进程返回可识别的模型证据，宿主不会启动任何子代理。
  const spawns = [];
  childProcess.spawn = (_command, args) => {
    spawns.push([...args]);
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = () => true;
    queueMicrotask(() => {
      const requested = modelArg(args).replace(/:(off|minimal|low|medium|high|xhigh|max)$/, '');
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
  return spawns;
}

function checkAgentProfiles(parseFrontmatter, agentDir) {
  for (const name of AGENT_PROFILES) {
    const { frontmatter, body } = parseFrontmatter(readFileSync(join(agentDir, `${name}.md`), 'utf8'));
    assert.equal(frontmatter.name, name);
    assert.equal(frontmatter.model, undefined);
    assert.ok(frontmatter.description.length > 20 && body.includes('禁止Computer Use'));
  }
}

async function loadLegacyTool(jiti, nativeEntry) {
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
  return tool;
}

function syntheticContext(cwd) {
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
  return {
    cwd,
    model: { provider: 'openai', id: 'gpt-6-luna' },
    thinkingLevel: 'max',
    hasUI: false,
    modelRegistry: { getAvailable: () => models },
  };
}

async function checkSingleDispatch(run, spawns) {
  const single = await run({ agent: 'worker', task: 'synthetic no-op', model: 'openai/gpt-6.1-sol:medium' });
  assert.ok(!single.isError, JSON.stringify(single));
  assert.equal(modelArg(spawns.at(-1)), 'openai/gpt-6.1-sol:medium');
  assert.ok(!spawns.at(-1).includes('--thinking'), 'parent thinking must not override explicit suffix');
  assert.equal(single.details.results[0].requestedModel, 'openai/gpt-6.1-sol:medium');
  assert.equal(single.details.results[0].model, 'openai/gpt-6.1-sol-synthetic-host');
}

async function checkBatchDispatch(run, spawns) {
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
    spawns.slice(-2).map(modelArg).sort(),
    ['openai/gpt-6-luna:low', 'openai/gpt-6.1-terra:high'].sort(),
  );
  await run({
    model: 'openai/gpt-6-luna:medium',
    chain: [
      { agent: 'worker', task: 'a', model: 'openai/gpt-6.1-sol:high' },
      { agent: 'scout', task: '{previous}' },
    ],
  });
  assert.deepEqual(spawns.slice(-2).map(modelArg), ['openai/gpt-6.1-sol:high', 'openai/gpt-6-luna:medium']);
}

async function checkInheritedModel(run, spawns) {
  await run({ agent: 'worker', task: 'inherit' });
  const args = spawns.at(-1);
  const thinkingIndex = args.indexOf('--thinking');
  assert.equal(modelArg(args), 'openai/gpt-6-luna');
  assert.deepEqual(args.slice(thinkingIndex, thinkingIndex + 2), ['--thinking', 'max']);
}

async function checkRejectedSelections(run, spawns) {
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
}

const hostLocation = process.argv[2] ?? process.env.PI_EXTENSION_HOST_ROOT;
const entry = process.argv[3];
assert.ok(hostLocation && entry, '传入已有Pi包根目录与获准的现有subagent/index.ts；不自动查找或安装');
const host = openPiHost(hostLocation);
const nativeEntry = resolve(entry);
const nativeDir = dirname(nativeEntry);
const agentDir = resolve(nativeDir, '../../agents');
const aliases = hostModulePaths(host);
for (const value of Object.values(aliases)) assert.ok(existsSync(value), value);
checkDeployment(nativeDir, agentDir);

const temp = mkdtempSync(join(tmpdir(), 'pi-subagent-smoke-'));
const originalSpawn = childProcess.spawn;
try {
  const sourceFiles = [nativeEntry, join(nativeDir, 'agents.ts'), join(nativeDir, 'model-selection.ts')];
  checkTypes(temp, { hostRoot: host.root, aliases }, sourceFiles);
  const spawns = captureSpawns();
  const jiti = createHostLoader(host, import.meta.url, aliases);
  const sdk = await jiti.import(aliases['@earendil-works/pi-coding-agent']);
  checkAgentProfiles(sdk.parseFrontmatter, agentDir);
  const tool = await loadLegacyTool(jiti, nativeEntry);
  const ctx = syntheticContext(temp);
  const run = (params) => tool.execute('synthetic-smoke', params, undefined, undefined, ctx);
  await checkSingleDispatch(run, spawns);
  await checkBatchDispatch(run, spawns);
  await checkInheritedModel(run, spawns);
  await checkRejectedSelections(run, spawns);
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
