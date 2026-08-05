import { vmNumberToBigInt } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { hash160 } from '@solidcash/utils';
import {
  Contract, SignatureTemplate, SortedList, StatefulContract, getEntryNftAddress, keyToSlot,
} from '../../src/index.js';
import { alicePriv, alicePub, bobPub } from '../fixture/vars.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const SOURCE = `contract Erc20Like() {
  bigint totalSupply;
  mapping(bytes20 => bigint) balances;
  event Transfer(bytes20 indexed from, bytes20 indexed to, bigint amount);
  error InsufficientBalance(bigint requested, bigint available);

  function mint(bytes20 to, bigint amount, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.totalSupply = this.totalSupply + amount;
    this.balances[to] = this.balances[to] + amount;
    emit Transfer(bytes20(0), to, amount);
  }

  function transfer(bytes20 from, bytes20 to, bigint amount, pubkey pk, sig s) {
    require(hash160(pk) == from);
    require(checkSig(s, pk));
    bigint available = this.balances[from];
    if (available < amount) { revert InsufficientBalance(amount, available); }
    this.balances[from] = available - amount;
    this.balances[to] = this.balances[to] + amount;
    emit Transfer(from, to, amount);
  }
}`;

const artifact = compileString(SOURCE);

async function deploy(): Promise<{ provider: ReturnType<typeof createTestProvider>; sc: StatefulContract }> {
  const provider = createTestProvider();
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { totalSupply: 0n }, { saltContract: true },
  );
  return { provider, sc: StatefulContract.withCategory(contract, categoryId) };
}

async function balanceOf(
  provider: ReturnType<typeof createTestProvider>, sc: StatefulContract, holder: Uint8Array,
): Promise<bigint> {
  const address = getEntryNftAddress(sc.inner, sc.categoryId, 'balances');
  const entry = SortedList.fromUtxos(await provider.getUtxos(address)).find(keyToSlot(holder));
  return entry ? vmNumberToBigInt(entry.value) : 0n;
}

describe('ERC-20-like application conformance', () => {
  it('mints and transfers balances while preserving total supply', async () => {
    const { provider, sc } = await deploy();
    const alice = hash160(alicePub);
    const bob = hash160(bobPub);
    const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    await sc.mint(alice, 100n, alicePub, signature()).send();
    await sc.transfer(alice, bob, 35n, alicePub, signature()).send();

    expect(await balanceOf(provider, sc, alice)).toBe(65n);
    expect(await balanceOf(provider, sc, bob)).toBe(35n);
    const state = await sc.getState();
    expect(state.totalSupply).toBe(100n);
  });

  it('decodes Transfer event arguments for mint and transfer', async () => {
    const { sc } = await deploy();
    const alice = hash160(alicePub);
    const bob = hash160(bobPub);
    const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    await sc.mint(alice, 100n, alicePub, signature()).send();
    await sc.transfer(alice, bob, 35n, alicePub, signature()).send();
    const events = await sc.queryFilter('Transfer');

    expect(events.map((event) => event.args)).toEqual([
      { from: new Uint8Array(20), to: alice, amount: 100n },
      { from: alice, to: bob, amount: 35n },
    ]);
  });

  it('publishes the insufficient-balance error signature and refuses an overdraw', async () => {
    const { sc } = await deploy();
    const alice = hash160(alicePub);
    const bob = hash160(bobPub);
    const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
    expect(artifact.errors).toContainEqual({
      name: 'InsufficientBalance',
      signature: 'InsufficientBalance(bigint,bigint)',
      parameters: [
        { name: 'requested', type: 'bigint' },
        { name: 'available', type: 'bigint' },
      ],
    });

    await sc.mint(alice, 10n, alicePub, signature()).send();
    await expect(sc.transfer(alice, bob, 11n, alicePub, signature()).send())
      .rejects.toThrow(/OP_VERIFY|Program failed/);
  });
});
