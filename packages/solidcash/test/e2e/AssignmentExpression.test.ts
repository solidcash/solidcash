import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// `(x >>= 1)` used as an expression updates x AND yields its new value (Solidity assignment-as-expression).
// Verified on-chain: a most-significant-bit loop computes the right answer each iteration from the read-back.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  int result;
  function msb(int x, pubkey pk, sig s) {
    require(checkSig(s, pk));
    int i = 0;
    while ((x >>= 1) > 0) { i = i + 1; }
    this.result = i;
  }
}`;

describe('assignment-as-expression (runtime)', () => {
  const provider = createTestProvider();
  it('a `while ((x >>= 1) > 0)` loop computes the most-significant-bit position on-chain', async () => {
    const art = compileString(SRC);
    const c = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, c, art.stateLayout!, { result: 0n }, { saltContract: true });
    const sc = StatefulContract.withCategory(c, categoryId);
    await sc.msb(12n, alicePub, new SignatureTemplate(alicePriv)).send();
    expect((await sc.getState()).result).toBe(3n); // 12 = 0b1100 -> shifts 6,3,1 (i=3) then 0 stops
  });
});
