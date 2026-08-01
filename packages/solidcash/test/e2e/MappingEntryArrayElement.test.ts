import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
const provider = createTestProvider();
async function mk(src) {
  const art = compileString(src, { solidityImportCompat: true, forceStateful: true, chunkedArrays: true });
  const c = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, c, art.stateLayout, {}, { saltContract: true });
  return StatefulContract.withCategory(c, categoryId);
}
describe('arr-in-mapping-value VM', () => {
  it('write dynamic array to a mapping entry, read back', async () => {
    const sc = await mk('contract C { mapping(uint=>uint16[]) ma; function w() public { uint16[] memory a=new uint16[](2); a[0]=13; a[1]=14; ma[0]=a; } function chk() public view { require(ma[0][0]==13 && ma[0][1]==14 && ma[0].length==2); } }');
    await sc.w().send();
    expect(await sc.chk().send()).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });
  it('struct-with-array-field mapping value write+read', async () => {
    const sc = await mk('contract C { struct S { uint16[] a; uint16 u; } mapping(uint=>S) m; function w() public { uint16[] memory q=new uint16[](2); q[0]=5; q[1]=6; m[0]=S(q,7); } function chk() public view { require(m[0].u==7 && m[0].a[0]==5 && m[0].a[1]==6); } }');
    await sc.w().send();
    expect(await sc.chk().send()).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });
});
