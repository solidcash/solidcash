import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// EXPERIMENTAL memory model P3: boundary serialization. `return a` on a memory value-array no longer forces the
// array to fall back to value-copy - it stays a memory-model pointer (so aliasing/composition work) and is
// serialized into a fresh value-copy array at the return boundary. The internal require()s prove aliasing on the
// buffer (b writes are visible through a - value-copy could NOT do this); a successful .send() proves the
// serialization loop runs on the VM as part of the covenant (a returning function's value is covenant-computed
// even without .emitReturn()).
const SOURCE = `
contract C() {
    int counter;
    function serializeReturn() returns (uint[] memory) {
        uint[] memory a = new uint[](3);
        a[0] = 5;
        a[1] = 7;
        a[2] = 9;
        uint[] memory b = a;
        b[0] = 100;
        require(a[0] == 100);
        require(a[2] == 9);
        return a;
    }
}`;

describe('memory model P3: boundary serialization (return)', () => {
  it('returns an aliased memory array, serializing the buffer at the boundary', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, {});
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.serializeReturn().send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
