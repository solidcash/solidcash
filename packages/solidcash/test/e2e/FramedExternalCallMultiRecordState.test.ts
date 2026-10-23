// A framed external call to a callee whose function writes more than one data NFT record. D49 gives each bigint
// state field a data NFT of its own, so a callee with two of them authenticates two records in one call; the
// caller's derivation has to learn both before it can settle the transaction.
import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { compileStringMulti } from '../direct-compile.js';

const SRC = `
  interface IStore { function set(bigint x, bigint y) external; }
  contract Store {
    bigint a;
    bigint b;
    function set(bigint x, bigint y) public { this.a = x; this.b = y; }
  }
  contract Caller {
    bigint calls;
    function go(address store) public { IStore(store).set(1, 2); this.calls = this.calls + 1; }
  }`;

describe('a framed external call that writes two data NFT records', () => {
  it('settles both records of the callee in one call', async () => {
    const arts = compileStringMulti(SRC);
    expect(arts.Store!.stateLayout!.dataNftCount).toBe(2);

    const provider = createTestProvider();
    const store = new Contract(arts.Store!, [], { provider });
    const { categoryId: storeCategory } = await setupStatefulUtxos(
      provider, store, arts.Store!.stateLayout!, { a: 0n, b: 0n }, { saltContract: true },
    );
    const storeAddress = store.withCategory(hexToBin(storeCategory)).lockingBytecode;
    const caller = new Contract(arts.Caller!, [], { provider });
    const { categoryId: callerCategory } = await setupStatefulUtxos(
      provider, caller, arts.Caller!.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const callerSc = StatefulContract.withCategory(caller, callerCategory);
    const storeSc = StatefulContract.withCategory(store, storeCategory);

    const tx = await callerSc.go(hexToBin(storeAddress))
      .withExternalCall(storeSc, 'set', [1n, 2n])
      .send();
    expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

    // Both records carry the written values, not the pre-call state of the second one.
    expect(await storeSc.getState()).toMatchObject({ a: 1n, b: 2n });
    expect((await callerSc.getState()).calls).toBe(1n);
  });
});
