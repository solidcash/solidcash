import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// The safety gate (P2.5): with experimentalMemoryModel ON, an array used in a way the pass does NOT handle (here
// abi.encode - a boundary) taints its whole alias group, which falls back to the value-copy path. These are VM
// gates proving the FALLBACK is runtime-correct: abi.encode(a) must serialize the array CONTENTS (length > 32
// bytes for a 3-element array), NOT the pointer integer (which would be a single 32-byte word). A gate failure -
// converting `a` to a pointer while abi.encode still ran - would make enc.length == 32 and reject the tx.
const SOURCE = `
contract C() {
    int counter;
    function encodeFallsBack() {
        uint[] memory a = new uint[](3);
        a[0] = 11;
        a[1] = 22;
        a[2] = 33;
        bytes memory enc = abi.encode(a);
        require(enc.length > 32);
        require(a[0] + a[1] + a[2] == 66);
        this.counter = 1;
    }
    function mixedConvertAndFallback() {
        uint[] memory conv = new uint[](2);
        conv[0] = 5;
        conv[1] = 7;
        conv[0] = 9;
        uint[] memory fb = new uint[](2);
        fb[0] = 100;
        fb[1] = 200;
        bytes memory e = abi.encode(fb);
        require(conv[0] == 9);
        require(conv[1] == 7);
        require(e.length > 32);
        this.counter = 2;
    }
}`;

describe('experimental memory model: safety gate fallback (P2.5)', () => {
  const opts = { experimentalMemoryModel: true };
  const run = async (method: 'encodeFallsBack' | 'mixedConvertAndFallback'): Promise<void> => {
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

  it('an abi.encode boundary falls back and serializes contents, not a pointer', async () => {
    await run('encodeFallsBack');
  });
  it('a converted array and a fallback array coexist correctly in one function', async () => {
    await run('mixedConvertAndFallback');
  });
});
