import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
const provider = createTestProvider();
async function mk(src: string): Promise<StatefulContract> {
  const art = compileString(src, { solidityImportCompat: true, forceStateful: true, chunkedArrays: true });
  const c = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, c, art.stateLayout!, {}, { saltContract: true });
  return StatefulContract.withCategory(c, categoryId);
}
// push onto an array field reached through a nested flattened-struct member chain (t.s.b.push()).
const SRC = `contract C {
  struct Inner { uint[] b; }
  struct S { Inner s; uint u; }
  S t;
  function w() public { t.s.b.push(7); t.s.b.push(9); t.u = 1; }
  function chk() public view { require(t.s.b.length == 2 && t.s.b[0] == 7 && t.s.b[1] == 9 && t.u == 1); }
}`;
describe('nested flattened-struct-field array push (runtime)', () => {
  it('pushes through t.s.b and reads elements back', async () => {
    const sc = await mk(SRC);
    await sc.w().send();
    await expect(sc.chk().send()).resolves.toBeDefined();
  });
});
