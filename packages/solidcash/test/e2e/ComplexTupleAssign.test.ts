import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Complex-lvalue tuple targets `(x[0], s.e) = (a, b)`: the require()s run on-chain, so a wrong write aborts
// the spend. Compiled forceStateful so each call is a self-poke covenant.
const SOURCE = `
contract C() {
    function indexTargets(int a, int b) {
        int[3] x;
        (x[0], x[2]) = (a, b);
        require(x[0] == a);
        require(x[1] == 0);
        require(x[2] == b);
    }
    function memberTargets(int a, int b) {
        S memory s;
        (s.v, s.w) = (a, b);
        require(s.v == a && s.w == b);
    }
    function mixedSkip(int a, int b) {
        int[3] m;
        int last;
        (m[0], m[1], , last) = (a, b, 999, a + b);
        require(m[0] == a && m[1] == b && m[2] == 0 && last == a + b);
    }
    function nestedField(int a, int b) {
        S memory s;
        (s.arr[0], s.arr[1]) = (a, b);
        require(s.arr[0] == a && s.arr[1] == b);
    }
}
struct S { int v; int w; int[2] arr; }
`;

const artifact = compileString(SOURCE, { forceStateful: true });

describe('complex-lvalue tuple targets (runtime)', () => {
  it('writes index targets, leaving the untouched element zero', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.indexTargets(5n, 7n)).resolves.toBeDefined();
  });
  it('writes struct member targets', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.memberTargets(3n, 4n)).resolves.toBeDefined();
  });
  it('writes index targets with a skipped slot and evaluates the dropped value position', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.mixedSkip(2n, 6n)).resolves.toBeDefined();
  });
  it('writes into a nested struct-field array', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.nestedField(8n, 9n)).resolves.toBeDefined();
  });
});
