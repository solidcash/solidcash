/* eslint-disable max-len */
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// A fixed-width struct chunk-packed state array: the element must round-trip as a whole value. `this.arr[i] =
// P(x, y)` overwrites one element; `this.arr.push(P(x, y))` appends; both must preserve the untouched fields and
// neighbouring elements, and read back on-chain and off-chain identically.
const SRC = `struct P { int x; int y; }
contract C() {
  P[] arr;
  function pushArr(int x, int y, pubkey pk, sig s) { require(checkSig(s, pk)); this.arr.push(P(x, y)); }
  function setArr(int i, int x, int y, pubkey pk, sig s) { require(checkSig(s, pk)); this.arr[i] = P(x, y); }
  function checkArr(int i, int ex, int ey) { require(this.arr[i].x == ex); require(this.arr[i].y == ey); }
  function checkLen(int n) { require(this.arr.length == n); }
}`;

describe('fixed-width struct chunk-packed array element overwrite', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  const deploy = async (): Promise<Record<string, (...args: unknown[]) => { send: () => Promise<{ txid: string }> }>> => {
    const artifact = compileString(SRC, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { arr: [] }, { saltContract: true },
    );
    return StatefulContract.withCategory(contract, categoryId) as never;
  };

  it('pushes two fixed-width struct elements and reads them back', async () => {
    const sc = await deploy();
    await sc.pushArr(10n, 20n, alicePub, sig()).send(); // arr[0] = P(10, 20)
    await sc.checkArr(0n, 10n, 20n).send();
    await sc.pushArr(30n, 40n, alicePub, sig()).send(); // arr[1] = P(30, 40)
    await sc.checkArr(0n, 10n, 20n).send(); // untouched neighbour preserved
    await sc.checkArr(1n, 30n, 40n).send();
    await sc.checkLen(2n).send();
    expect(await sc.getState()).toMatchObject({ arr: [{ x: 10n, y: 20n }, { x: 30n, y: 40n }] });
  });

  it('overwrites a single fixed-width struct element in place', async () => {
    const sc = await deploy();
    await sc.pushArr(10n, 20n, alicePub, sig()).send();
    await sc.pushArr(30n, 40n, alicePub, sig()).send();
    await sc.setArr(0n, 99n, 88n, alicePub, sig()).send(); // arr[0] = P(99, 88)
    await sc.checkArr(0n, 99n, 88n).send();
    await sc.checkArr(1n, 30n, 40n).send(); // untouched neighbour preserved
    expect(await sc.getState()).toMatchObject({ arr: [{ x: 99n, y: 88n }, { x: 30n, y: 40n }] });
  });
});
