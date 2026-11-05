import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../../../solidc/src/compiler.js';
import { StatefulContract } from '../../src/stateful/StatefulContract.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { framedTokenContainerLockingBytecode } from '../../src/framed/call/token-containers.js';
import type { Utxo } from '../../src/interfaces.js';

/**
 * A contract creation argument is encoded into the framed program, so an entry may name it as its token-container
 * key. The handle keeps the values beside the filled bytecode so a call can resolve `this.tokens[category]` and pay
 * from the contract's container; the state NFT carries no slot for them.
 */
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract TokenPool(int denomination, bytes32 category) {'
  + '   int balance;'
  + '   constructor() { }'
  + '   function deposit(int amount) public {'
  + '     require(this.outState.tokens[category].tokenAmount == this.tokens[category].tokenAmount + amount, "value");'
  + '     this.balance = this.balance + amount;'
  + '   }'
  + '   function pay(address recipient) public {'
  + '     this.tokens[category].transfer(recipient, denomination);'
  + '   }'
  + '   function reserve() view returns (int) { return this.tokens[category].tokenAmount; }'
  + ' }';

describe('a framed entry with a token container keyed by a creation argument', () => {
  it('deposits into the container and pays exactly the denomination from it', async () => {
    const artifact = compileString(SOURCE, { composition: 'framed' });
    expect(artifact.constructorInputs.map((input) => input.name)).toEqual(['denomination', 'category']);
    expect(artifact.stateLayout?.variables.map((variable) => variable.name)).toEqual(['balance']);

    const provider = new MockNetworkProvider();
    const [alice, bob] = await provider.getSigners(2, { fundingUtxos: 8, genesisFundingUtxos: 2 });
    const bobLock = bob.getLockingBytecode();
    const genesisCoin = { txid: 'e4'.repeat(32), vout: 0, satoshis: 2_000_000n };
    const tokenCategory = 'e2'.repeat(32);
    const tokenFunding = { txid: tokenCategory, vout: 0, satoshis: 100_000n };
    const holderCoin: Utxo = {
      txid: 'e3'.repeat(32), vout: 0, satoshis: 50_000n,
      token: { category: tokenCategory, amount: 1_000n },
    };
    await provider.addUtxo(alice.getAddress(), genesisCoin);
    await provider.addUtxo(alice.getAddress(), tokenFunding);
    await provider.addUtxo(alice.getAddress(), holderCoin);

    const { contract, categoryId } = await StatefulContract.deploy(
      artifact,
      [100n, hexToBin(tokenCategory)],
      {
        provider,
        fundingUtxo: genesisCoin,
        funder: alice.unlockP2PKH(),
        changeAddress: alice.getAddress(),
        nativeToken: { funding: tokenFunding, reserve: 1_000n },
      },
    );
    expect(contract.inner.artifact.creationArguments?.map((argument) => argument.name))
      .toEqual(['denomination', 'category']);
    expect((await contract.getState()).balance).toBe(0n);

    const calls = contract.connect(alice).call as unknown as {
      readonly deposit: (amount: bigint) => {
        withTokenDeposits: (deposits: readonly {
          utxo: Utxo; unlocker: ReturnType<typeof alice.unlockP2PKH>; amount: bigint;
        }[]) => { send: () => Promise<unknown> };
      };
      readonly pay: (recipient: Uint8Array) => { send: () => Promise<unknown> };
      readonly reserve: () => { staticCall: () => Promise<{ value?: bigint }> };
    };
    const containerLock = framedTokenContainerLockingBytecode(categoryId, tokenCategory);
    const containerAmount = async (): Promise<bigint> =>
      (await provider.getUtxosForLockingBytecode(containerLock))
        .filter((utxo) => utxo.token?.category === tokenCategory)
        .reduce((sum, utxo) => sum + utxo.token!.amount, 0n);
    expect(await containerAmount()).toBe(1_000n);
    expect((await calls.reserve().staticCall()).value).toBe(1_000n);

    await calls.deposit(600n)
      .withTokenDeposits([{ utxo: holderCoin, unlocker: alice.unlockP2PKH(), amount: 600n }])
      .send();
    expect((await contract.getState()).balance).toBe(600n);
    expect(await containerAmount()).toBe(1_600n);

    await calls.pay(bobLock).send();
    expect(await containerAmount()).toBe(1_500n);
    const received = (await provider.getUtxosForLockingBytecode(bobLock))
      .filter((utxo) => utxo.token?.category === tokenCategory)
      .reduce((sum, utxo) => sum + utxo.token!.amount, 0n);
    expect(received).toBe(100n);
  }, 900_000);

  it('splits creation arguments from the constructor block\'s own arguments', async () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract D(int x, bytes32 y) { int z; constructor(int z_) { z = z_; }'
      + '   function get() view returns (int) { return x; }'
      + '   function getZ() view returns (int) { return this.z; } }';
    const artifact = compileString(source, { composition: 'framed' });
    const provider = new MockNetworkProvider();
    const [alice] = await provider.getSigners(1, { fundingUtxos: 8, genesisFundingUtxos: 2 });
    const coin = (await alice.getUtxos()).find((utxo) => !utxo.token && utxo.satoshis >= 200_000n);
    if (coin === undefined) throw new Error('no funding coin');

    const { contract } = await StatefulContract.deploy(artifact, [7n, new Uint8Array(32).fill(9)], {
      provider,
      fundingUtxo: coin,
      funder: alice.unlockP2PKH(),
      changeAddress: alice.getAddress(),
      initArgs: [42n],
    });

    const read = await contract.connect(alice).call.get().staticCall() as { value?: bigint };
    expect(read.value).toBe(7n);
    expect((await contract.getState()).z).toBe(42n);
  }, 900_000);
});
