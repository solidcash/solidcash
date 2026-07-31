import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// An unnamed return type that falls off the end returns the type default (Solidity parity). `g` assigns a local
// and never returns, so it yields 0; `check` calls it and requires the result.
const SRC = `contract C() {
  function g(int x) internal pure returns(int) { int y = x + 1; }
  function check(int expected) { require(g(5) == expected); }
}`;

describe('unnamed return defaults on fall-through', () => {
  const provider = createTestProvider();
  const art = compileString(SRC, { solidityImportCompat: true, forceStateful: true });
  const contract = new Contract(art, [], { provider });

  it('g() returns 0 (the int default), not the local value', async () => {
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.check(0n).send();       // g(5) falls through -> returns 0
    expect(tx.txid).toBeDefined();
    await expect(sc.check(6n).send()).rejects.toThrow('layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.'); // NOT the local x+1
  });
});
