import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cases = [
  ['compiler destructive-operation defaults', 'solidc', 'test/SafetyDefaults.test.ts',
    'Caller-controlled destructive authority'],
  ['vmap batch witness tampering', 'solidcash', 'test/e2e/VMapBatchAdversarial.test.ts'],
  ['dynamic-loop entry tampering', 'solidcash', 'test/e2e/DynamicLoopEntryAdversarial.test.ts'],
  ['external-call target substitution', 'solidcash', 'test/e2e/ExtcallTargetPinning.test.ts'],
  ['cross-contract unsupported subcases', 'solidcash', 'test/e2e/CrossContractSubcaseSoundness.test.ts'],
  ['delegate identity and selector pinning', 'solidcash', 'test/e2e/Delegatecall.test.ts',
    'C1/piece-3: pins the delegate identity AND function'],
  ['lifecycle auxiliary-element integrity', 'solidcash', 'test/e2e/LifecycleAuxiliaryAdversarial.test.ts'],
  ['scalar data-NFT state integrity', 'solidcash', 'test/e2e/ScalarStateAdversarial.test.ts'],
  ['dynamic state-chunk integrity', 'solidcash', 'test/e2e/DynamicChunkAdversarial.test.ts'],
  ['satoshi-container integrity', 'solidcash', 'test/e2e/SatoshiContainerIntegrity.test.ts'],
  ['token-container integrity', 'solidcash', 'test/e2e/TokenContainerIntegrity.test.ts'],
  ['event and emitted-return integrity', 'solidcash', 'test/e2e/EventReturnIntegrity.test.ts'],
  ['default proxy integrity', 'solidcash', 'test/e2e/DefaultProxyIntegrity.test.ts'],
  ['shipped proxy artifact consistency', 'solidcash', 'test/e2e/X50DefaultProxyRegenerated.test.ts',
    'matches a fresh compile field for field'],
  ['message-envelope and return forgery', 'solidcash',
    'test/journal-message-bus/e2e/MessageBusEnvelopeBindingAudit.test.ts'],
];

if (process.argv.includes('--list')) {
  for (const [name, workspace, file] of cases) console.log(`${name}: packages/${workspace}/${file}`);
  process.exit(0);
}

console.log(`Running ${cases.length} release security scenarios:`);
for (const [name, workspace, file] of cases) console.log(`- ${name}: packages/${workspace}/${file}`);

for (const [name, workspace, file, pattern] of cases) {
  console.log(`\n[${name}]`);
  const result = spawnSync(
    process.platform === 'win32' ? 'yarn.cmd' : 'yarn',
    ['workspace', workspace, 'vitest', 'run', file, ...(pattern ? ['-t', pattern] : [])],
    { cwd: root, stdio: 'inherit', env: process.env },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
