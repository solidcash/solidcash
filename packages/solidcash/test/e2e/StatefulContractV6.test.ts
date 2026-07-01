import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment } from '@solidcash/utils';
import {
  Contract, StatefulContract, StatefulFunctionCall, Signer,
} from '../../src/index.js';
import { alicePriv } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

// ethers-v6-flavored surface: a lean constructor `new StatefulContract(category, artifact, runner, { args })`,
// an async `StatefulContract.at(address, artifact, runner)` that reads the category from the indexer, Proxy
// dispatch so `sc.increment()` / `sc.count()` hit the ABI function / state getter on the bare name, and a
// `getFunction()` escape hatch. NetworkProvider runner = read-only-first, Signer = adds funding/signing.
const SRC = `pragma solidcash >=0.8.0;
contract Counter(int step) {
  int count;
  function increment() { this.count = this.count + step; require(true); }
}`;

describe('StatefulContract v6 flavor: lean constructor + at() + Proxy dispatch', () => {
  const art = compileString(SRC);

  async function deployCounter(): Promise<{ provider: ReturnType<typeof createTestProvider>;
    categoryId: string; address: string; }> {
    const provider = createTestProvider();
    const contract = new Contract(art, [5n], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, art.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const address = contract.withCategory(hexToBin(categoryId)).address;
    return { provider, categoryId, address };
  }

  it('lean constructor (category + provider) reads state, categoryId and address', async () => {
    const { provider, categoryId, address } = await deployCounter();
    const sc = new StatefulContract(categoryId, art, provider, { constructorArgs: [5n] });
    expect(sc.categoryId).toBe(categoryId);
    expect(sc.address).toBe(address);
    expect(await sc.getState()).toEqual({ count: 0n });
    // Byte-identical to the classic withCategory path.
    const classic = StatefulContract.withCategory(new Contract(art, [5n], { provider }), categoryId);
    expect(sc.inner.lockingBytecode).toBe(classic.inner.lockingBytecode);
  });

  it('Proxy dispatch: bare-name state getter and ABI function', async () => {
    const { provider, categoryId } = await deployCounter();
    const sc = new StatefulContract(categoryId, art, provider, { constructorArgs: [5n] });
    // Bare-name state getter (sc.count()) resolves through the proxy - no cast needed (new is typed).
    expect(await sc.count()).toBe(0n);
    // Bare-name ABI function (sc.increment()) returns a StatefulFunctionCall, same as sc.call.increment().
    expect(sc.increment()).toBeInstanceOf(StatefulFunctionCall);
    expect(sc.getFunction('increment')).toBe((sc.call as any).increment);
    expect(() => sc.getFunction('nope')).toThrow(/No function 'nope'/);
    // 'increment' and 'count' report present via the has trap.
    expect('increment' in sc).toBe(true);
    expect('count' in sc).toBe(true);
  });

  it('StatefulContract.at(address, ...) attaches by address, resolving the category from the indexer', async () => {
    const { provider, categoryId, address } = await deployCounter();
    const sc = await StatefulContract.at(address, art, provider, { constructorArgs: [5n] });
    expect(sc.categoryId).toBe(categoryId);
    expect(await sc.getState()).toEqual({ count: 0n });
    // A 64-char category id also works (used directly, no lookup).
    const byCat = await StatefulContract.at(categoryId, art, provider, { constructorArgs: [5n] });
    expect(byCat.address).toBe(address);
  });

  it('read-write: a lean instance sends and mutates state (count += step)', async () => {
    const { provider, categoryId } = await deployCounter();
    const signer = new Signer(alicePriv, provider);
    const sc = await StatefulContract.at(categoryId, art, signer, { constructorArgs: [5n] });
    const tx = await sc.increment().send();
    expect(tx.txid).toBeDefined();
    const dataNft = getTxOutputs(tx).find(
      (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === categoryId,
    );
    const state = parsePushdataCommitment(dataNft!.token!.nft!.commitment, art.stateLayout!, 0);
    expect(state.count).toBe(5n);
  });

  it('the sync constructor rejects an address (points to the async at())', async () => {
    const { provider, address } = await deployCounter();
    expect(() => new StatefulContract(address, art, provider, { constructorArgs: [5n] }))
      .toThrow(/not a 64-char category id.*StatefulContract\.at/s);
  });
});
