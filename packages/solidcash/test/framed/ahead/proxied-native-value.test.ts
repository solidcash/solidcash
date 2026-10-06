import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { FramedProxyDeployError } from '../../../src/framed/proxy/index.js';
import { compileFramed, deployPlain, deployProxied, enterProxied, newWorld } from './composition-world.js';

/**
 * Walls ahead: native value (BCH) through a contract behind its proxy, past what the hop serves. Value into a
 * payable entry and sends to users' locks settle (`call/proxied-native-value.test.ts`): the proxy's root frame takes
 * the value, its delegate frame sees it as `msg.value`, and the implementation's sends pay from the proxy's
 * containers. A send from the implementation's body to another contract is a call into the recipient's `receive()`,
 * made where the body sends (spec 4b), whose frame the hop does not plan (the plain call path plans it as a paid
 * contract's frame, `call/call.ts`), so it is refused by name before any plan.
 *
 * The case pins what is met today; its title says what should settle once served. The file runs only under
 * `FRAMED_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Bank {',
  '  address public implementation;',
  '  uint256 public paid;',
  '  function initialize(uint256 start) public { paid = start; }',
  '  function payTo(address to, uint256 amount) external {',
  '    paid += amount;',
  '    payable(to).transfer(amount);',
  '  }',
  '}',
  'contract Vault {',
  '  uint256 public received;',
  '  receive() external payable { received += msg.value; }',
  '}',
].join('\n');

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead: native value through a proxy, past what the hop serves', () => {
  it('refuses a send to a contract from the implementation\'s body, by name (should settle once the hop plans the '
    + 'recipient\'s receive() frame)', async () => {
    const world = await newWorld(0x54);
    const units = compileFramed(SOURCE);
    const bank = await deployProxied(world, units.Bank!, [0n]);
    const recipient = await deployPlain(world, units.Vault!);
    const outcome = await enterProxied(world, bank, 'payTo', [recipient.address, 5_000n]);
    expect(outcome.error).toBeInstanceOf(FramedProxyDeployError);
    expect(outcome.error!.message).toBe('the implementation\'s "payTo" entry sends to the contract at '
      + `${binToHex(recipient.address)}, which a call through a proxy does not pay yet`);
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);
});
