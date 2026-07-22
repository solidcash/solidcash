import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';

// This suite exercises + asserts the DEFAULT (entry-model) push/pop byte format. C2 push/pop (the default now) is
// covered by SortedMappingArrayElementWrite; opt this file out so it keeps testing the default entry model.
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> =>
  _csRawSolidc(s, o);
import { createTestProvider, setupStatefulUtxos, getTxOutputs } from '../test-util.js';
import { alicePub, alicePriv, aliceAddress } from '../fixture/vars.js';

const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

// `mapping(K => T[])` with `.push()` / `.pop()`: a read-modify-write of the entry's dynamic-array value. Uses a
// An `address` key is passed as a CashAddress here; the SDK normalizes it to the locking bytecode for both the
// write and the entry search (see Argument.ts / StatefulContract key resolution).
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  mapping(address => uint256[]) m;
  function push(address k, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k].push(v); }
  function pop(address k, pubkey pk, sig s) { require(checkSig(s, pk)); m[k].pop(); }
}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dep(): Promise<any> {
  const provider = createTestProvider();
  const art = compileString(SRC, { solidityImportCompat: true });
  const contract = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
  return StatefulContract.withCategory(contract, categoryId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function entryCommitment(tx: any): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry = getTxOutputs(tx).find((o: any) => o.token?.nft?.capability === 'mutable'
    && (o.token?.nft?.commitment?.length ?? 0) > 0);
  expect(entry).toBeDefined();
  return entry.token.nft.commitment;
}

describe('mapping(K => T[]) .push() / .pop()', () => {
  it('compiles; push is a read-modify-write entry access', () => {
    const art = compileString(SRC, { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ea = (art.abi.find((f: any) => f.name === 'push') as any)?.entryAccesses?.[0];
    expect(ea.operations).toEqual(['read', 'write']);
  });

  it('push encodes the value into the entry array', async () => {
    const sc = await dep();
    const c = entryCommitment(await sc.push(aliceAddress, 0xABCDn, alicePub, sig()).send());
    expect(c.includes('cdab')).toBe(true); // 0xABCD little-endian, 32-byte packed
  });

  it('push,push accumulates [a, b] across txs (co-spends + appends to the prior entry)', async () => {
    const sc = await dep();
    const c1 = entryCommitment(await sc.push(aliceAddress, 0x42n, alicePub, sig()).send());
    const c2 = entryCommitment(await sc.push(aliceAddress, 0x37n, alicePub, sig()).send());
    expect(c1.includes('42')).toBe(true);
    expect(c2.includes('42')).toBe(true); // first element preserved
    expect(c2.includes('37')).toBe(true); // second element appended
    expect(c2.length).toBeGreaterThan(c1.length);
  });

  it('pop drops the last element', async () => {
    const sc = await dep();
    await sc.push(aliceAddress, 0x42n, alicePub, sig()).send();
    await sc.push(aliceAddress, 0x37n, alicePub, sig()).send();
    const popped = entryCommitment(await sc.pop(aliceAddress, alicePub, sig()).send());
    expect(popped.includes('42')).toBe(true);  // first remains
    expect(popped.includes('37')).toBe(false); // last dropped
  });
});
