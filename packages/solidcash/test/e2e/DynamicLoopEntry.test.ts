import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from '@solidcash/solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const inputZeroVerifyFailure = /^messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;

// A DYNAMIC-bound loop (int[] calldata, runtime length) that writes a mapping. Unlike the fixed-bound case
// (unrolled to N static writes), this compiles to a native OP_BEGIN/OP_UNTIL covenant loop that mints one new
// entry NFT per iteration at a runtime-counter-indexed trailing output. The SDK derives the N (key,value) pairs
// from the VM trace and builds N trailing entry outputs. This proves ALL N entries land and read back.
const SRC = `contract C() {
  mapping(int => int) bal;
  function setAll(int[] ks, int[] vs, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (uint i = 0; i < ks.length; i = i + 1) { bal[ks[i]] = vs[i]; }
  }
  function check(int k, int e, pubkey pk, sig sg) { require(checkSig(sg, pk)); require(bal[k] == e); }
}`;

describe('dynamic-bound loop mapping write (runtime OP_BEGIN/OP_UNTIL entry mint)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('compiles to a vmap upsert-loop covenant (not unrolled)', () => {
    const art = compileString(SRC);
    const setAll = art.abi.find((f) => f.name === 'setAll');
    expect(setAll?.sortedUpsertLoopInfo?.map((info) => info.collection)).toEqual(['bal']);
    // The loop write is NOT surfaced as a fixed entry slot.
    expect(setAll?.entryAccesses).toBeUndefined();
  });

  it('writes all N entries the loop assigns (N=3), each readable back', async () => {
    const art = compileString(SRC);
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    let sc = StatefulContract.withCategory(contract, categoryId);

    const tx = await sc.setAll([10n, 20n, 30n], [111n, 222n, 333n], alicePub, sig).send();
    expect(tx.txid).toBeDefined();

    // Each entry is readable back off the persisted state.
    for (const [k, e] of [[10n, 111n], [20n, 222n], [30n, 333n]] as const) {
      sc = StatefulContract.withCategory(contract, categoryId);
      expect((await sc.check(k, e, alicePub, sig).send()).txid).toBeDefined();
    }
    // A wrong value is rejected (the entry genuinely holds its assigned value).
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(10n, 999n, alicePub, sig).send()).rejects.toThrow(inputZeroVerifyFailure);
  });

  it('writes mapping keys in a do-while loop', async () => {
    const src = `contract C {
      mapping(int => int) bal;
      function setAll(int[] ks, int[] vs, pubkey pk, sig sg) {
        require(checkSig(sg, pk));
        int i = 0;
        do { bal[ks[i]] = vs[i]; i = i + 1; } while (i < ks.length);
      }
      function check(int k, int e, pubkey pk, sig sg) { require(checkSig(sg, pk)); require(bal[k] == e); }
    }`;
    const art = compileString(src);
    expect(art.abi.find((f) => f.name === 'setAll')?.sortedUpsertLoopInfo?.map((info) => info.collection))
      .toEqual(['bal']);
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    let sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.setAll([5n, 6n], [55n, 66n], alicePub, sig).send()).txid).toBeDefined();
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(6n, 66n, alicePub, sig).send()).txid).toBeDefined();
  });

  it('handles N=1 (single iteration) and N=2', async () => {
    const art = compileString(SRC);
    const contract = new Contract(art, [], { provider });

    const setup1 = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    let sc = StatefulContract.withCategory(contract, setup1.categoryId);
    expect((await sc.setAll([7n], [77n], alicePub, sig).send()).txid).toBeDefined();
    sc = StatefulContract.withCategory(contract, setup1.categoryId);
    expect((await sc.check(7n, 77n, alicePub, sig).send()).txid).toBeDefined();

    const setup2 = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    sc = StatefulContract.withCategory(contract, setup2.categoryId);
    expect((await sc.setAll([1n, 2n], [11n, 22n], alicePub, sig).send()).txid).toBeDefined();
    sc = StatefulContract.withCategory(contract, setup2.categoryId);
    expect((await sc.check(2n, 22n, alicePub, sig).send()).txid).toBeDefined();
  });
});
