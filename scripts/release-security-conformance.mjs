import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cases = [
  ['C2 batch witness tampering', 'test/e2e/C2BatchAdversarial.test.ts'],
  ['dynamic-loop entry tampering', 'test/e2e/DynamicLoopEntryAdversarial.test.ts'],
  ['external-call target substitution', 'test/e2e/ExtcallTargetPinning.test.ts'],
  ['cross-contract unsupported subcases', 'test/e2e/CrossContractSubcaseSoundness.test.ts'],
  ['delegate identity and selector pinning', 'test/e2e/Delegatecall.test.ts'],
  ['lifecycle auxiliary-element integrity', 'test/e2e/LifecycleAuxiliaryAdversarial.test.ts'],
  ['scalar data-NFT state integrity', 'test/e2e/ScalarStateAdversarial.test.ts'],
  ['dynamic state-chunk integrity', 'test/e2e/DynamicChunkAdversarial.test.ts'],
  ['satoshi-container integrity', 'test/e2e/SatoshiContainerIntegrity.test.ts'],
  ['token-container integrity', 'test/e2e/TokenContainerIntegrity.test.ts'],
  ['message-envelope and return forgery', 'test/journal-message-bus/e2e/MessageBusEnvelopeBindingAudit.test.ts'],
];

if (process.argv.includes('--list')) {
  for (const [name, file] of cases) console.log(`${name}: packages/solidcash/${file}`);
  process.exit(0);
}

console.log(`Running ${cases.length} release security scenarios:`);
for (const [name, file] of cases) console.log(`- ${name}: packages/solidcash/${file}`);

const result = spawnSync(
  process.platform === 'win32' ? 'yarn.cmd' : 'yarn',
  ['workspace', 'solidcash', 'vitest', 'run', ...cases.map(([, file]) => file)],
  { cwd: root, stdio: 'inherit', env: process.env },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
