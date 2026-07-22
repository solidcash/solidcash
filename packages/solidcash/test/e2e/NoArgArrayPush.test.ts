import { describe, it } from 'vitest';
import { compileString as _csRawSolidc } from 'solidc';

// Default (entry-model) array push/pop byte format; C2 push/pop is covered by SortedMappingArrayElementWrite.
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> =>
  _csRawSolidc(s, o);
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv, aliceAddress } from '../fixture/vars.js';

// No-arg `push()` (Solidity's default-append): `arr.push()` / `this.arr.push()` / `m[k].push()` append the
// element type's zero value. Verified by reading `.length` and `[i]` back after the append.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  uint256[] xs;
  mapping(address => uint256[]) m;
  function pushDefault(pubkey pk, sig s) { require(checkSig(s, pk)); xs.push(); }
  function pushThisDefault(pubkey pk, sig s) { require(checkSig(s, pk)); this.xs.push(); }
  function pushVal(uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); xs.push(v); }
  function count(int n) { require(xs.length == n); }
  function elem(int i, uint256 e) { require(xs[i] == e); }
  function mPushDefault(address k, pubkey pk, sig s) { require(checkSig(s, pk)); m[k].push(); }
  function mCount(address k, int n) { require(m[k].length == n); }
  function mElem(address k, int i, uint256 e) { require(m[k][i] == e); }
}`;

describe('no-arg push() appends the element-type default', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function dep(): Promise<any> {
    const art = compileString(SRC, { solidityImportCompat: true });
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    return StatefulContract.withCategory(contract, categoryId);
  }

  it('bare xs.push() appends 0, a later xs.push(v) appends v', async () => {
    const sc = await dep();
    await sc.pushDefault(alicePub, sig()).send();
    await sc.count(1n).send();
    await sc.elem(0n, 0n).send();          // default element is zero
    await sc.pushVal(5n, alicePub, sig()).send();
    await sc.count(2n).send();
    await sc.elem(1n, 5n).send();
  });

  it('this.xs.push() appends 0', async () => {
    const sc = await dep();
    await sc.pushThisDefault(alicePub, sig()).send();
    await sc.count(1n).send();
    await sc.elem(0n, 0n).send();
  });

  it('m[k].push() appends 0 to the mapping entry array', async () => {
    const sc = await dep();
    await sc.mPushDefault(aliceAddress, alicePub, sig()).send();
    await sc.mCount(aliceAddress, 1n).send();
    await sc.mElem(aliceAddress, 0n, 0n).send();
  });
});
