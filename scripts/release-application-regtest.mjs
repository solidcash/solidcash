import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const applications = [
  ['ERC-20-like ledger, events, and error flow', 'test/e2e/Erc20LikeApplication.test.ts'],
  ['escrow, oracle release, and absolute timelock', 'test/e2e/HodlVault.test.ts'],
];

if (process.argv.includes('--list')) {
  for (const [name, file] of applications) console.log(`${name}: packages/solidcash/${file}`);
  process.exit(0);
}

console.log(`Running ${applications.length} serial BCHN application scenarios:`);
for (const [name, file] of applications) console.log(`- ${name}: packages/solidcash/${file}`);

const result = spawnSync(
  process.platform === 'win32' ? 'yarn.cmd' : 'yarn',
  [
    'workspace', 'solidcash', 'vitest', 'run', '--no-file-parallelism',
    ...applications.map(([, file]) => file),
  ],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, TESTS_USE_REGTEST: 'true', RELEASE_SIZE_REPORT: '1' },
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
