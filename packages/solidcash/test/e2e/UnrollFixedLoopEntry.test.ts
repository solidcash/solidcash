import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A fixed-bound loop that writes a mapping unrolls to N static writes. This proves BOTH entries land (not just the
// last, which is what the runtime-loop path would wrongly produce) - the soundness invariant for the unroll.
const SRC = `contract C() {
  mapping(int => int) bal;
  function setAll(int[2] ks, int[2] vs, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (int i = 0; i < 2; i = i + 1) { bal[ks[i]] = vs[i]; }
  }
  function check(int k, int e, pubkey pk, sig sg) { require(checkSig(sg, pk)); require(bal[k] == e); }
}`;

describe('fixed-bound loop mapping write (unrolled to N static entry writes)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('writes BOTH entries the loop assigns (bal[10]=111, bal[20]=222), each readable back', async () => {
    const art = compileString(SRC);
    // The write function must NOT hit EntryWriteInLoopError (proves the unroll fired).
    expect(art.abi.find((f) => f.name === 'setAll')).toBeDefined();

    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    let sc = StatefulContract.withCategory(contract, categoryId);

    const tx = await sc.setAll([10n, 20n], [111n, 222n], alicePub, sig).send();
    expect(tx.txid).toBeDefined();

    // Both entries are readable back off the persisted state.
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(10n, 111n, alicePub, sig).send()).txid).toBeDefined();
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(20n, 222n, alicePub, sig).send()).txid).toBeDefined();
    // A wrong value is rejected (the entry genuinely holds 111/222, not a stale/last-only value).
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(10n, 999n, alicePub, sig).send()).rejects.toThrow();
  });
});
