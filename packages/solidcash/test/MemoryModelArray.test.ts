import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// EXPERIMENTAL memory model (experimentalMemoryModel flag): a `uint[] memory` is a pointer into a per-function
// linear buffer. Element writes are single in-place stores that compose, and `b = a` shares the buffer (an
// alias), which the value-copy model cannot express. The require()s are VM gates - a successful send proves the
// buffer round-trip (bytes32<->uint word), multi-write composition, length, and aliasing all hold on-chain.
const SOURCE = `
contract C() {
    int counter;
    function multiWrite() {
        uint[] memory a = new uint[](3);
        a[0] = 42;
        a[1] = 7;
        a[0] = 99;
        require(a[0] == 99);
        require(a[1] == 7);
        require(a.length == 3);
        this.counter = 1;
    }
    function aliasing() {
        uint[] memory a = new uint[](2);
        uint[] memory b = a;
        b[0] = 42;
        a[1] = 8;
        require(a[0] == 42);
        require(b[1] == 8);
        this.counter = 2;
    }
}`;

describe('experimental memory model: uint[] memory', () => {
  const opts = { experimentalMemoryModel: true };

  it('composes multiple in-place element writes (a[0]=42; a[1]=7; a[0]=99)', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, opts);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.multiWrite().send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('aliases: b = a shares the buffer, so writes through either are visible in both', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, opts);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.aliasing().send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
