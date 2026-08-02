import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex, bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { hash160 } from '@solidcash/utils';
import { compileString } from './direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../src/index.js';
import { keyToSlot, encodeEntryCommitment, slotValueToBytes, getEntryNftAddress, SortedList } from '../src/index.js';
import { alicePriv, alicePub } from './fixture/vars.js';
import { createTestProvider } from './test-util.js';

// A value-returning internal helper doing a C2 (sorted) mapping RMW inside an `unchecked` block - OZ Nonces
// `_useNonce`: `unchecked { return _nonces[owner]++; }` (the EIP-2612 permit nonce). It co-spends the sorted-list
// entry slots (block layout, only an entry point has one), so it cannot be an OP_INVOKE subroutine; the returning
// helper is inlined into the entry caller. SOUNDNESS: `return m[k]++` desugars to the SAVE-OLD form
// (`__t = m[k]; m[k] = __t+1; return __t`), NOT the postval-minus-1 reconstruction (`m[k]=m[k]+1; return m[k]-1`)
// which re-reads the entry AFTER its write - a C2 entry cannot be read after it is co-spent, so the reconstruction
// OP_VERIFY-fails when inlined. This drives one RMW against a PRE-SEEDED entry and requires the read-old/return-pre/
// write-new behaviour, for BOTH the helper (inline) and the direct form (baseline).
const SRC = `contract C() {
  mapping(bytes20 => bigint) nonces;
  function _useNonce(bytes20 owner) internal returns (bigint) {
    unchecked { return this.nonces[owner]++; }
  }
  function bumpHelper(pubkey pk, sig s, bigint expected) {
    require(checkSig(s, pk));
    bytes20 pkh = hash160(pk);
    bigint n = _useNonce(pkh);
    require(n == expected);
  }
  function bumpDirect(pubkey pk, sig s, bigint expected) {
    require(checkSig(s, pk));
    bytes20 pkh = hash160(pk);
    bigint n = this.nonces[pkh]++;
    require(n == expected);
  }
  function bumpManual(pubkey pk, sig s, bigint expected) {
    require(checkSig(s, pk));
    bytes20 pkh = hash160(pk);
    bigint t = this.nonces[pkh];
    this.nonces[pkh] = this.nonces[pkh] + 1;
    require(t == expected);
  }
}`;

describe('value-returning C2 mapping RMW helper (OZ Nonces._useNonce) inlines soundly (save-old)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  async function seedAndRun(method: string, expected: bigint): Promise<bigint | 'revert'> {
    const art = compileString(SRC, {});
    expect(art.stateLayout?.collections?.find((c) => c.name === 'nonces')?.sorted).toBe(true);
    const contract = new Contract(art, [], { provider });
    const pkh = hash160(alicePub);
    const slot = keyToSlot(pkh);
    const ZERO = slotValueToBytes(0n);
    // Seed HEAD[0 | next=slot] + entry[slot | next=0 | value=5] so the RMW takes the UPDATE branch.
    const result = await provider.addTokenUtxosDynamic((cat: string) => {
      const pinned = contract.category ? contract : contract.withCategory(hexToBin(cat));
      const ea = getEntryNftAddress(pinned, cat, 'nonces');
      return [
        { address: pinned.tokenAddress, satoshis: 10000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: ea, satoshis: 1500n, token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(ZERO, slot)) } } },
        {
          address: ea,
          satoshis: 1500n,
          token: {
            amount: 0n,
            nft: {
              capability: 'mutable',
              commitment: binToHex(encodeEntryCommitment(slot, ZERO, bigIntToVmNumber(5n))),
            },
          },
        },
      ];
    });
    const categoryId = result.categoryId;
    const ea = getEntryNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, 'nonces');
    const sc = StatefulContract.withCategory(contract, categoryId);
    try {
      const call = (sc as unknown as Record<
      string, (...a: unknown[]) => { send(): Promise<unknown> }
      >)[method];
      await call(alicePub, sig, expected).send();
    } catch {
      return 'revert';
    }
    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(slot);
    return e ? vmNumberToBigInt(e.value) : -1n;
  }

  it('HELPER _useNonce: reads old nonce 5, returns it, writes 6 (inline is SOUND)', async () => {
    expect(await seedAndRun('bumpHelper', 5n)).toBe(6n);
  });
  it('DIRECT this.nonces[pkh]++: reads 5, returns it, writes 6 (baseline)', async () => {
    expect(await seedAndRun('bumpDirect', 5n)).toBe(6n);
  });
  it('MANUAL read-old-temp + RMW (the desugar output, no helper): writes 6', async () => {
    expect(await seedAndRun('bumpManual', 5n)).toBe(6n);
  });
  it('HELPER rejects a wrong expected pre-value (returned nonce is exact)', async () => {
    expect(await seedAndRun('bumpHelper', 7n)).toBe('revert');
  });
});
