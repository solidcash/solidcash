import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [
  {
    name: 'clean SolidHat project initialization, compilation, and generated test',
    args: [
      'workspace', '@solidcash/solidhat', 'vitest', 'run', 'test/init.test.ts',
      '-t', 'compiles and tests a generated project end to end',
    ],
  },
  {
    name: 'cold/warm compilation cache, dependency invalidation, artifact retention, and clean',
    args: [
      'workspace', '@solidcash/testing', 'vitest', 'run', 'test/incremental-compile.e2e.test.ts',
      '-t', 'runs cold, warm, invalidated, factory-resolution, and clean paths end to end',
    ],
  },
  {
    name: 'stateless calls and maintained stateful deploy/call/assert/reset golden path',
    args: [
      'workspace', 'testing-suite', 'vitest', 'run',
      'test/example.test.ts', 'test/harness.test.ts', 'test/block-timestamp.test.ts', 'test/golden-path.test.ts',
    ],
  },
];

if (process.argv.includes('--list')) {
  for (const check of checks) console.log(check.name);
  process.exit(0);
}

console.log(`Running ${checks.length} generated-project release checks:`);
for (const check of checks) {
  console.log(`- ${check.name}`);
  const result = spawnSync(process.platform === 'win32' ? 'yarn.cmd' : 'yarn', check.args, {
    cwd: root, stdio: 'inherit', env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
