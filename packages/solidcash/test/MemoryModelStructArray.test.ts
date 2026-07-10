import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// EXPERIMENTAL memory model (P5b): an array of value-field structs (`T[] memory`) stores a POINTER per element.
// A struct-array element field write `arr[i].f = v` is a single in-place store at (arr[i] pointer) + 32*fieldIdx.
// This is THE case the value-copy read-modify-rebuild model miscompiles (the element has its own fields); the
// pointer model composes correctly. The require()s are VM gates.
const SOURCE = `
contract C() {
    int counter;
    struct T { uint y; uint z; }
    function elemFieldWrites() {
        T[] memory arr = new T[](3);
        arr[0] = T(1, 2);
        arr[1] = T(3, 4);
        arr[2] = T(5, 6);
        arr[0].y = 9;
        arr[0].z = 8;
        arr[0].y = 5;
        arr[1].z = 40;
        require(arr[0].y == 5);
        require(arr[0].z == 8);
        require(arr[1].y == 3);
        require(arr[1].z == 40);
        require(arr[2].y == 5);
        require(arr[2].z == 6);
        this.counter = 1;
    }
    function loopBuild() {
        T[] memory arr = new T[](4);
        for (uint i = 0; i < arr.length; i++) {
            arr[i] = T(i, i * 2);
        }
        for (uint j = 0; j < arr.length; j++) {
            arr[j].y = arr[j].y + 100;
        }
        require(arr[0].y == 100);
        require(arr[3].y == 103);
        require(arr[3].z == 6);
        this.counter = 2;
    }
}`;

describe('experimental memory model: array of value-field structs (P5b)', () => {
  const opts = { experimentalMemoryModel: true };
  const run = async (method: 'elemFieldWrites' | 'loopBuild'): Promise<void> => {
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

  it('composes struct-array element field writes (the value-copy miscompile case)', async () => {
    await run('elemFieldWrites');
  });
  it('builds and updates a struct array in native loops', async () => { await run('loopBuild'); });
});
