import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

const verifyFailure = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// Struct-valued sorted mapping `mapping(int => P)`. A struct is an encoded blob (its on-stack representation), so
// it is stored verbatim in the (last) value tail; a field read `pos[k].x` decodes that blob. Present -> the stored
// struct, absent -> the zero struct. vmap-sound as usual. (Non-encodable structs - mappings/recursive - fail closed.)
const SRC = `contract C() {
  struct P { int x; int y; }
  mapping(int => P) pos;
  function setP(int k, int x, int y, pubkey pk, sig s) { require(checkSig(s, pk)); pos[k] = P(x, y); }
  function checkXY(int k, int ex, int ey, pubkey pk, sig s) { require(checkSig(s, pk)); require(pos[k].x == ex); require(pos[k].y == ey); }
}`;

describe('sorted struct-valued mapping', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('pos[k]=P(x,y) stores a struct value; pos[k].x/.y read fields; update works', async () => {
    const art = compileString(SRC, {});
    const contract = new Contract(art, [], { provider });
    const ZERO = slotValueToBytes(0n);

    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'pos');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, ZERO)) } } },
      ];
    });
    const categoryId = result.categoryId;
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'pos');
    const present = async (k: bigint): Promise<boolean> =>
      SortedList.fromUtxos(await provider.getUtxos(ea)).has(keyToSlot(bigIntToVmNumber(k)));
    const call = (fn: 'setP' | 'checkXY', ...a: unknown[]): Promise<{ txid: string }> => {
      type Caller = Record<string, (...args: unknown[]) => { send: () => Promise<{ txid: string }> }>;
      return (StatefulContract.withCategory(contract, categoryId) as unknown as Caller)[fn](...a, alicePub, sig).send();
    };

    // Insert pos[5] = P(11, 22); both fields read back.
    expect((await call('setP', 5n, 11n, 22n)).txid).toBeDefined();
    expect(await present(5n)).toBe(true);
    expect(await call('checkXY', 5n, 11n, 22n)).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
    await expect(call('checkXY', 5n, 11n, 99n)).rejects.toThrow(verifyFailure);

    // Update pos[5] = P(33, 44) (present-key update of a struct value).
    expect((await call('setP', 5n, 33n, 44n)).txid).toBeDefined();
    expect(await call('checkXY', 5n, 33n, 44n)).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });
});
