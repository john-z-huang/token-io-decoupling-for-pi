#!/usr/bin/env node
// Use an existing Pi installation; never download dependencies or alter its configuration.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const project = fileURLToPath(new URL('../', import.meta.url));
let host = process.argv[2] ?? process.env.PI_EXTENSION_HOST_ROOT;
if (!host) {
  try {
    host = dirname(dirname(createRequire(import.meta.url).resolve('@earendil-works/pi-coding-agent')));
  } catch {
    console.error('请传已有 Pi 包根目录，或设置 PI_EXTENSION_HOST_ROOT；不自动安装依赖。');
    process.exit(2);
  }
}
host = resolve(host);
const metadata = JSON.parse(readFileSync(join(host, 'package.json'), 'utf8'));
if (metadata.name !== '@earendil-works/pi-coding-agent') throw new Error('不是 Pi Coding Agent 包根目录');
const requireHost = createRequire(join(host, 'package.json'));
const typebox = requireHost
  .resolve('typebox')
  .replace(/\.mjs$/, '.d.mts')
  .replace(/\.js$/, '.d.ts');
const temp = mkdtempSync(join(tmpdir(), 'pi-extension-types-'));
try {
  writeFileSync(
    join(temp, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2023',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        allowImportingTsExtensions: true,
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        types: ['node'],
        typeRoots: [join(host, 'node_modules/@types')],
        paths: { '@earendil-works/pi-coding-agent': [join(host, 'dist/index.d.ts')], typebox: [typebox] },
      },
      include: [join(project, 'extensions/**/*.ts')],
    }),
  );
  const result = spawnSync(process.env.TSC_BIN ?? 'tsc', ['-p', join(temp, 'tsconfig.json')], {
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else console.log(`Pi ${metadata.version} 宿主声明类型检查通过（不代表真实客户端验收）`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
