import { describe, expect, it } from 'vitest';
import Signer from '../../../src/Signer.js';
import { PerCallCallError, PerCallFunctionCall } from '../../../src/per-call/call/index.js';
import { alicePriv } from '../../fixture/vars.js';
import {
  compilePerCall, deployProxied, enterProxied, newWorld, recordMet, refusedVerdicts, type ProxiedDeployment,
  type World,
} from './composition-world.js';

/**
 * Walls ahead: native value (BCH) in and out of a contract behind its proxy, as an upgradeable sale, auction or
 * vault takes and pays it. The plain call path carries a call's value and plans a body's sends; the hop carries
 * neither:
 *
 * - in: a handle on a proxied deployment refuses a call with value before planning
 *   (`call/handle.ts`, "a delegate frame takes none yet"), and `callPerCallProxyEntry` has no value option at all;
 * - out: the hop states the implementation frame with `value: 0n` and `sends: []` (`proxy/deploy.ts`), so an
 *   entry that pays someone is planned with an empty send region and no satoshi containers to pay from.
 *
 * Each case pins what is met today; its title says what should settle once the hop carries value.
 * The file runs only under `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Bank {',
  '  address public implementation;',
  '  uint256 public received;',
  '  uint256 public paid;',
  '  function initialize(uint256 start) public { received = start; }',
  '  function deposit() external payable { received += msg.value; }',
  '  function withdraw(uint256 amount) external {',
  '    paid += amount;',
  '    payable(msg.sender).transfer(amount);',
  '  }',
  '}',
].join('\n');

interface Chain { readonly world: World; readonly bank: ProxiedDeployment }
let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x54);
    const bank = await deployProxied(world, compilePerCall(SOURCE).Bank!, [0n]);
    return { world, bank };
  })();
  return chainRun;
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: native value through a proxy', () => {
  it('compiles both entries', async () => {
    const { bank } = await chain();
    expect(bank.artifact.composition?.refusedEntries ?? []).toStrictEqual([]);
  }, 600_000);

  it('refuses a payable deposit with value through the handle (should settle once served)', async () => {
    const { world, bank } = await chain();
    await world.userCoin();
    const abiEntry = bank.artifact.abi.find((entry) => entry.name === 'deposit')!;
    const call = new PerCallFunctionCall({
      artifact: bank.artifact,
      abiEntry: abiEntry as never,
      categoryId: bank.proxyCategoryId,
      provider: world.network,
      signer: new Signer(alicePriv, world.network),
      proxyImplementationCategoryId: bank.implementationCategoryId,
    }, 'deposit', []).withValue(1_000n);
    await expect(call.send()).rejects.toThrow(new PerCallCallError(
      'a call to "deposit" through a proxy carries no value: a delegate frame takes none yet',
    ));
  }, 600_000);

  it('does not settle a withdraw that pays the caller (should settle once served)', async () => {
    const { world, bank } = await chain();
    const outcome = await enterProxied(world, bank, 'withdraw', [500n]);
    recordMet('proxied-native-value/withdraw', outcome.error?.message
      ?? (outcome.result === undefined ? undefined : refusedVerdicts(outcome.result)));
    expect(outcome.result?.broadcast).toBeUndefined();
    expect(outcome.coinSpent).toBe(false);
    expect(outcome.error?.message).toMatch(/^the implementation's "withdraw" entry did not settle through the proxy: /);
  }, 600_000);
});
