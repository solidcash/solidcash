import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

const artifact = compileString(`contract TransferOrStore() {
  int public stored;
  function store(int value) public {
    require(msg.value == 0);
    this.stored = value;
    require(true);
  }
  function payout(address destination, int amount) public {
    this.stored = amount;
    this.transfer(destination, amount);
    require(true);
  }
}`, { forceStateful: true, messageBus: true, messageBusKernel: true, suppressWarnings: true });
const callerArtifact = compileString(`interface IWallet {
  function store(int value) external;
  function payout(address destination, int amount) external;
}
contract Caller() {
  function set(address wallet, int value) public { IWallet(wallet).store(value); require(true); }
  function send(address wallet, address destination, int amount) public {
    IWallet(wallet).payout(destination, amount); require(true);
  }
}`, { forceStateful: true, messageBus: true, messageBusKernel: true, suppressWarnings: true });

async function setup(): Promise<{
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>;
  contract: StatefulContract;
  caller: StatefulContract;
}> {
  const provider = createMessageBusCapstoneTestProvider();
  const base = new Contract(artifact, [], { provider });
  const seeded = await setupStatefulUtxos(
    provider, base, artifact.stateLayout!, { stored: 0n }, { saltContract: true },
  );
  const contract = StatefulContract.withCategory(
    base.withCategory(hexToBin(seeded.categoryId)), seeded.categoryId,
  );
  const callerBase = new Contract(callerArtifact, [], { provider });
  const callerSeeded = await setupStatefulUtxos(
    provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
  );
  const caller = StatefulContract.withCategory(
    callerBase.withCategory(hexToBin(callerSeeded.categoryId)), callerSeeded.categoryId,
  );
  caller._registerResolvedExternal('IWallet', contract);
  return { provider, contract, caller };
}

describe('kernel selected satoshi container', () => {
  it('does not require an unfunded sibling transfer container in composition', async () => {
    const { provider, contract, caller } = await setup();
    expect(artifact.messageBus!.route.blockLayout!.slots.some((slot) => slot.kind === 'satoshiContainer'))
      .toBe(true);
    expect(await provider.getUtxos(contract.satoshiContainer.address)).toEqual([]);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const call = messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'set', args: [contract.inner.lockingBytecode, 42n] },
        { contract, functionName: 'store', args: [42n],
          callsiteId: callerArtifact.abi.find((fn) => fn.name === 'set')!.externalCalls![0].callsiteId },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    expect(messageBusVmAccepts(await call.build())).toBe(true);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await contract.getState()).stored).toBe(42n);
    expect(await provider.getUtxos(contract.satoshiContainer.address)).toEqual([]);
  }, 180_000);

  it('still requires and conserves the real container for a selected payout', async () => {
    const { provider, contract, caller } = await setup();
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const destination = funder.unlocker.generateLockingBytecode();
    const call = messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'send', args: [contract.inner.lockingBytecode, destination, 1_000n] },
        { contract, functionName: 'payout', args: [destination, 1_000n],
          callsiteId: callerArtifact.abi.find((fn) => fn.name === 'send')!.externalCalls![0].callsiteId },
      ],
      funder, changeAddress: destination,
    });
    await expect(call.build()).rejects.toThrow(/Satoshi container UTXO not found/);
    await provider.addUtxo(contract.satoshiContainer.address, {
      txid: 'a9'.repeat(32), vout: 0, satoshis: 5_000n,
    });
    const builder = await call.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    expect(builder.outputs.some((output) => output.amount === 1_000n)).toBe(true);
    const hostile = await call.build();
    const containerOutput = hostile.outputs.find((output) => output.amount === 4_000n && !output.token);
    expect(containerOutput).toBeDefined();
    containerOutput!.amount -= 1n;
    expect(messageBusVmAccepts(hostile)).toBe(false);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await contract.getState()).stored).toBe(1_000n);
    expect((await provider.getUtxos(contract.satoshiContainer.address)).map((utxo) => utxo.satoshis))
      .toEqual([4_000n]);
  }, 180_000);
});
