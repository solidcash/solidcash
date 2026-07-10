import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// EXPERIMENTAL memory model (P5b-fields): a struct with a REFERENCE field (`struct S{ uint[] a; uint n; }`) holds
// a POINTER in that field's word. `s.a[i] = v` pre-desugars to `uint[] tmp = s.a; tmp[i] = v; s = S(tmp, s.n)`,
// and with the gate's candidacy fixpoint tmp aliases s.a (the same buffer array), so the nested write composes
// in place and is visible through both s.a and the original array. require()s are VM gates.
const SOURCE = `
contract C() {
    int counter;
    struct S { uint[] a; uint n; }
    function arrayField() {
        uint[] memory arr = new uint[](3);
        arr[0] = 10;
        arr[1] = 20;
        arr[2] = 30;
        S memory s = S(arr, 99);
        s.a[1] = 25;
        s.a[2] = 35;
        require(s.a[0] == 10);
        require(s.a[1] == 25);
        require(s.a[2] == 35);
        require(s.n == 99);
        require(arr[1] == 25);
        require(arr[2] == 35);
        this.counter = 1;
    }
    function loopOverField() {
        uint[] memory arr = new uint[](4);
        S memory s = S(arr, 0);
        for (uint i = 0; i < s.a.length; i++) {
            s.a[i] = i * 100;
        }
        require(s.a[0] == 0);
        require(s.a[3] == 300);
        require(s.a.length == 4);
        this.counter = 2;
    }
}`;

describe('experimental memory model: struct with a reference (array) field (P5b-fields)', () => {
  const opts = { experimentalMemoryModel: true };
  const run = async (method: 'arrayField' | 'loopOverField'): Promise<void> => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, opts);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc[method]().send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  };

  it('composes nested writes through a struct array field and aliases the source array', async () => {
    await run('arrayField');
  });
  it('loops over a struct array field via s.a.length and s.a[i]', async () => {
    await run('loopOverField');
  });
});
