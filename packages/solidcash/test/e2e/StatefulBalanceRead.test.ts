import { describe, expect, it } from 'vitest';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { ContractFactory } from '../../src/stateful/ContractFactory.js';
import { compileString } from '../direct-compile.js';

const SOURCE = `pragma solidcash ^0.52.0;
contract BalanceReader {
  int public observed;
  event Recorded(int amount);

  function deposit() public payable { require(msg.value > 0); }
  function readBalance() public view returns (int) { return this.balance; }
  function recordBalance() public {
    this.observed = this.balance;
    emit Recorded(this.observed);
  }
}`;

describe('a direct stateful call that reads the satoshi balance', () => {
  it.each([50_000n, 0n])('records %s satoshis and preserves the balance', async (balance) => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const [signer] = await provider.getSigners(1);
    const vault = await new ContractFactory(compileString(SOURCE), signer).deploy({
      initialBalance: balance, initialState: { observed: -1n },
    });
    expect(await vault.getBalance()).toBe(balance);

    expect(await vault.withProvider(provider).call.readBalance().staticCall()).toBe(balance);
    const receipt = await vault.call.recordBalance().send();

    expect(await vault.state.observed()).toBe(balance);
    expect(receipt.events).toMatchObject([{ event: 'Recorded', args: { amount: balance } }]);
    expect(await vault.getBalance()).toBe(balance);
  });

  it('reads the incoming balance during a payable deposit', async () => {
    const artifact = compileString(`contract DepositReader {
      int public observed;
      function deposit() public payable { require(msg.value > 0); this.observed = this.balance; }
    }`);
    const provider = new MockNetworkProvider({ profile: 'production' });
    const [signer] = await provider.getSigners(1);
    const vault = await new ContractFactory(artifact, signer).deploy();

    await vault.call.deposit().withValue(10_000n).send();
    expect(await vault.state.observed()).toBe(0n);
    await vault.call.deposit().withValue(2_000n).send();
    expect(await vault.state.observed()).toBe(10_000n);
    expect(await vault.getBalance()).toBe(12_000n);
  });

  it('does not reserve a container for a state field named balance', () => {
    const artifact = compileString(`contract FieldReader {
      int balance;
      int observed;
      function recordBalance() public { this.observed = this.balance; }
    }`);
    const layout = artifact.abi.find((fn) => fn.name === 'recordBalance')?.blockLayout;
    expect(layout).toBeDefined();
    expect(layout!.slots.some((slot) => slot.kind === 'satoshiContainer')).toBe(false);
  });
});
