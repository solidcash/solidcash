import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract, StatefulContract } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// EXPERIMENTAL memory model P3: state-write boundary. `this.s = a` on a memory value-array no longer forces the
// array to fall back to value-copy - it stays a memory-model pointer (so aliasing works) and the buffer is
// serialized into a fresh value-copy array at the state-write boundary. `w()` builds a, aliases b=a, mutates via
// b, then writes a to state; `chk()` reads the state back and proves it holds the ALIASED value [99, 2] (a
// value-copy fallback would have stored [1, 2] because b[0]=99 would not have been visible through a).
const SOURCE = `
contract C() {
    uint[] s;
    function w() {
        uint[] memory a = new uint[](2);
        a[0] = 1;
        a[1] = 2;
        uint[] memory b = a;
        b[0] = 99;
        this.s = a;
        require(true);
    }
    function chk() {
        require(this.s.length == 2);
        require(this.s[0] == 99);
        require(this.s[1] == 2);
    }
}`;

describe('memory model P3: boundary serialization (state-write)', () => {
  it('writes an aliased memory array to state, serializing the buffer at the boundary', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, {});
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { s: [] }, { saltContract: true },
    );
    let sc = StatefulContract.withCategory(contract, categoryId);
    await sc.w().send();
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.chk().send()).resolves.toBeDefined();
  });
});
