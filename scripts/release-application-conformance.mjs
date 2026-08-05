import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Keep this list small, deterministic, and application-shaped. Feature-unit tests
// belong in the ordinary package suites; this gate is the release smoke matrix.
const applications = [
  ['ERC-20-like ledger, event, and error flow', 'test/e2e/Erc20LikeApplication.test.ts'],
  ['token integration', 'test/e2e/SafeErc20ChainTargetPinning.test.ts'],
  ['ownership / access control', 'test/e2e/CustomModifier.test.ts'],
  ['escrow, oracle release, and absolute timelock', 'test/e2e/HodlVault.test.ts'],
  ['proxy upgrade with preserved state', 'test/e2e/Upgrade.test.ts'],
  ['mapping plus dynamic-array state', 'test/e2e/IterableMappingPattern.test.ts'],
  ['cross-contract read and mutation', 'test/e2e/ExternalFunctionCalls.test.ts'],
  ['event argument and filtering facade', 'test/e2e/EventsFacade.test.ts'],
  ['custom-error, assert, and revert behavior', 'test/e2e/ErrorAssertRevert.test.ts'],
];

if (process.argv.includes('--list')) {
  for (const [name, file] of applications) console.log(`${name}: packages/solidcash/${file}`);
  process.exit(0);
}

console.log(`Running ${applications.length} release application scenarios:`);
for (const [name, file] of applications) console.log(`- ${name}: packages/solidcash/${file}`);

const result = spawnSync(
  process.platform === 'win32' ? 'yarn.cmd' : 'yarn',
  ['workspace', 'solidcash', 'vitest', 'run', ...applications.map(([, file]) => file)],
  { cwd: root, stdio: 'inherit', env: process.env },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
