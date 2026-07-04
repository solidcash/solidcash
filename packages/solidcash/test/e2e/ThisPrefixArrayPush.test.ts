import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos, getTxOutputs } from '../test-util.js';
import { alicePub, alicePriv, aliceAddress } from '../fixture/vars.js';

const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

// `this.`-prefixed indexed/member array push/pop (`this.m[k].push`, `this.arr[i].push`) route identically to the
// bare forms - this verifies the explicit-state spelling produces the same runtime result.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  mapping(address => uint256[]) m;
  function push(address k, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); this.m[k].push(v); }
  function pop(address k, pubkey pk, sig s) { require(checkSig(s, pk)); this.m[k].pop(); }
}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function entryCommitment(tx: any): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry = getTxOutputs(tx).find((o: any) => o.token?.nft?.capability === 'mutable'
    && (o.token?.nft?.commitment?.length ?? 0) > 0);
  expect(entry).toBeDefined();
  return entry.token.nft.commitment;
}

describe('this.-prefixed indexed array push/pop', () => {
  const provider = createTestProvider();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function dep(): Promise<any> {
    const art = compileString(SRC, { solidityImportCompat: true });
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    return StatefulContract.withCategory(contract, categoryId);
  }

  it('this.m[k].push accumulates then this.m[k].pop drops the last (same as bare)', async () => {
    const sc = await dep();
    const c1 = entryCommitment(await sc.push(aliceAddress, 0x42n, alicePub, sig()).send());
    const c2 = entryCommitment(await sc.push(aliceAddress, 0x37n, alicePub, sig()).send());
    expect(c2.includes('42')).toBe(true);  // first preserved
    expect(c2.includes('37')).toBe(true);  // second appended
    expect(c2.length).toBeGreaterThan(c1.length);
    const popped = entryCommitment(await sc.pop(aliceAddress, alicePub, sig()).send());
    expect(popped.includes('42')).toBe(true);
    expect(popped.includes('37')).toBe(false);
  });
});
