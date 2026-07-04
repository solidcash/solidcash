import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// A struct whose only representation-less field is a dynamic array (`struct S { uint256[] xs; }`) is flattened
// field-by-field, so `s.xs` backs a chunk-packed dynamic state var `s__xs`. `s.xs.push(v)` / `s.xs.pop()` are
// then the same read-modify-write element ops as a top-level state array. Verified via `.length` / `[i]` readers.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  struct S { uint256[] xs; }
  S s;
  function push(uint256 v, pubkey pk, sig sg) { require(checkSig(sg, pk)); s.xs.push(v); }
  function pop(pubkey pk, sig sg) { require(checkSig(sg, pk)); s.xs.pop(); }
  function count(int n) { require(s.xs.length == n); }
  function elem(int i, uint256 e) { require(s.xs[i] == e); }
}`;

describe('packed-struct field array push (s.xs.push / s.xs.pop)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('flattens the array field to a dynamic state var s__xs', () => {
    const art = compileString(SRC, { solidityImportCompat: true });
    const sv = art.stateLayout!.variables.find((v) => v.name === 's__xs');
    expect(sv).toBeDefined();
    expect(sv!.dynamic).toBe(true);
  });

  it('push accumulates [a, b] and pop drops the last element', async () => {
    const art = compileString(SRC, { solidityImportCompat: true });
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.push(0x42n, alicePub, sig()).send();
    await sc.count(1n).send();
    await sc.elem(0n, 0x42n).send();
    await sc.push(0x37n, alicePub, sig()).send();
    await sc.count(2n).send();
    await sc.elem(1n, 0x37n).send();
    await sc.pop(alicePub, sig()).send();
    await sc.count(1n).send();
    await sc.elem(0n, 0x42n).send(); // first element preserved after pop
  });
});
