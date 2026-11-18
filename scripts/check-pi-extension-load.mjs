#!/usr/bin/env node
// Isolated host-module smoke: no Pi session, global settings, MCP connection, model or network call.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
let root = process.argv[2] ?? process.env.PI_EXTENSION_HOST_ROOT;
if (!root) {
  try {
    root = dirname(dirname(createRequire(import.meta.url).resolve('@earendil-works/pi-coding-agent')));
  } catch {
    console.error('请传已有 Pi 包根目录，或设置 PI_EXTENSION_HOST_ROOT；不自动安装依赖。');
    process.exit(2);
  }
}
root = resolve(root);
const metadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
assert.equal(metadata.name, '@earendil-works/pi-coding-agent');
const requireHost = createRequire(join(root, 'package.json'));
const { createJiti } = requireHost('jiti');
const jiti = createJiti(import.meta.url, {
  moduleCache: false,
  fsCache: false,
  alias: { typebox: requireHost.resolve('typebox') },
});
const entry = fileURLToPath(new URL('../extensions/coding-workflow/index.ts', import.meta.url));
const factory = await jiti.import(entry, { default: true });
const tools = [],
  commands = [],
  events = [],
  flags = [];
factory({
  on: (name) => events.push(name),
  registerFlag: (name) => flags.push(name),
  registerCommand: (name) => commands.push(name),
  registerTool: (tool) => tools.push(tool),
});
assert.deepEqual(
  tools.map((t) => t.name),
  ['coding_checkpoint', 'coding_slice', 'coding_run', 'coding_delegate'],
);
assert.ok(
  events.includes('agent_before_settle') && events.includes('context') && events.includes('tool_call'),
);
assert.ok(!events.includes('session_switch') && !events.includes('session_fork'));
assert.equal(commands[0], 'coding');
assert.equal(flags.length, 7);
const valueModule = await import(pathToFileURL(requireHost.resolve('typebox/value')).href);
const check = valueModule.Value?.Check ?? valueModule.Check;
assert.equal(typeof check, 'function');
assert.equal(check(tools[0].parameters, { action: 'status' }), true);
assert.equal(
  check(tools[0].parameters, { action: 'rules', document: 'verification-epoch', fragment: 'actions' }),
  true,
);
assert.equal(check(tools[0].parameters, { action: 'rules', fragment: 3 }), false);
assert.equal(check(tools[0].parameters, { action: 'report', revision: 0, reports: [] }), false);
assert.equal(
  check(tools[2].parameters, {
    revision: 0,
    tool: 'bash',
    input: {},
    effect: 'fake',
    rationale: 'test',
    evidence: ['source'],
  }),
  false,
);
console.log(
  `Pi ${metadata.version} 提供的 Jiti/TypeBox：入口加载、注册及 Schema smoke 通过；非真实客户端/子代理/Memory 集成验收。`,
);
