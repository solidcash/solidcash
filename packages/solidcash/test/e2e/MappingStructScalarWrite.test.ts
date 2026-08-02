import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const verifyPreflight = 'layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// A state struct with a mapping field flattens to per-field state (`s__a` scalar + `s__c` mapping). The bare
// scalar field write `s.a = v` (the Solidity form) resolves to the flattened `s__a` state var, symmetric with
// the read side (`s.a` -> `s__a`). Verified end-to-end: write the field, then read it back off the persisted
// state (reads come from the input commitment), proving the written value actually landed in `s__a`.
const SRC = `contract C() {
  struct S { bigint a; mapping(bigint => bigint) c; }
  S s;
  function setA(bigint v, pubkey pk, sig sg) { require(checkSig(sg, pk)); s.a = v; }
  function checkA(bigint e, pubkey pk, sig sg) { require(checkSig(sg, pk)); require(s.a == e); }
}`;

describe('mapping-bearing struct scalar field write (s.a = v -> flattened s__a)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('writes the scalar field, then reads the written value back', async () => {
    const art = compileString(SRC);
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, art.stateLayout!, { s__a: 100n }, { saltContract: true },
    );
    let sc = StatefulContract.withCategory(contract, categoryId);

    // write s.a = 7 (the input holds s__a = 100)
    const tx = await sc.setA(7n, alicePub, sig).send();
    expect(tx.txid).toBeDefined();

    // read back off the persisted state: s.a is now 7
    sc = StatefulContract.withCategory(contract, categoryId);
    const readTx = await sc.checkA(7n, alicePub, sig).send();
    expect(readTx.txid).toBeDefined();
    // the wrong value is rejected by the covenant
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.checkA(100n, alicePub, sig).send()).rejects.toThrow(verifyPreflight);
  });
});
