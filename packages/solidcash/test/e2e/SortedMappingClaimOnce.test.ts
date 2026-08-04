/* eslint-disable max-len */
import { describe, it, expect } from 'vitest';
import { createVirtualMachineBch2026, hash256, hexToBin } from '@bitauth/libauth';
import { Op } from '@solidcash/utils';

// End-to-end claim-once (the headline C2 use case): `mapping(address => bool) claimed;
// function claim(a){ require(!claimed[a]); claimed[a] = true; }`. Backed by the sorted linked list, a claim IS an
// insert (which requires the key to be absent - the bracket Ps < k < S). So claiming an already-claimed key has
// no valid predecessor and reverts: claim-once, with no default-on-absent branch to omit. This walks a realistic
// sequence of claims building the list and shows a re-claim (and an omission attempt) rejected.

const CATEGORY = hexToBin('11'.repeat(32));
const masterToken = { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array([]) } };

function slot32(n: number): Uint8Array {
  const b = new Uint8Array(32); let v = n; let i = 0;
  while (v > 0) { b[i++] = v & 0xff; v = Math.floor(v / 256); }
  return b;
}
function commit(slot: number, nextKey: number): Uint8Array {
  const out = new Uint8Array(64); out.set(slot32(slot), 0); out.set(slot32(nextKey), 32); return out;
}
class Asm { b: number[] = []; op(...xs: number[]): this { this.b.push(...xs); return this; } pushData(d: Uint8Array): this { this.b.push(d.length, ...d); return this; } bytes(): Uint8Array { return new Uint8Array(this.b); } }

// The `claim` covenant == insert with the absence bracket. Stack in: [k32]. input1 = predecessor P. output1 =
// P'[Ps|k], output2 = NEW[k|S=P.next]. (Same as the proven insert covenant.)
function claimCovenant(): Uint8Array {
  const a = new Asm();
  const catBase = (idx: number, opCat: number): void => {
    a.op(idx, opCat).pushData(new Uint8Array([32])).op(Op.OP_SPLIT, Op.OP_DROP).pushData(CATEGORY).op(Op.OP_EQUALVERIFY);
  };
  catBase(Op.OP_1, Op.OP_UTXOTOKENCATEGORY);                 // [k32]
  a.op(Op.OP_1, Op.OP_UTXOTOKENCOMMITMENT).pushData(new Uint8Array([32])).op(Op.OP_SPLIT); // [k32, Ps32, S32]
  a.op(Op.OP_OVER, Op.OP_BIN2NUM);
  a.op(Op.OP_3, Op.OP_PICK, Op.OP_BIN2NUM);
  a.op(Op.OP_LESSTHAN, Op.OP_VERIFY);                        // Ps < k
  a.op(Op.OP_DUP, Op.OP_BIN2NUM, Op.OP_DUP, Op.OP_0, Op.OP_NUMEQUAL);
  a.op(Op.OP_IF); a.op(Op.OP_DROP);
  a.op(Op.OP_ELSE); a.op(Op.OP_3, Op.OP_PICK, Op.OP_BIN2NUM); a.op(Op.OP_SWAP, Op.OP_LESSTHAN, Op.OP_VERIFY);
  a.op(Op.OP_ENDIF);                                         // k < S (or +inf)
  catBase(Op.OP_1, Op.OP_OUTPUTTOKENCATEGORY);
  a.op(Op.OP_OVER); a.op(Op.OP_3, Op.OP_PICK, Op.OP_CAT);
  a.op(Op.OP_1, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY); // P' == Ps||k
  catBase(Op.OP_2, Op.OP_OUTPUTTOKENCATEGORY);
  a.op(Op.OP_2, Op.OP_PICK); a.op(Op.OP_1, Op.OP_PICK, Op.OP_CAT);
  a.op(Op.OP_2, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY); // NEW == k||S
  a.op(Op.OP_2DROP, Op.OP_DROP, Op.OP_1);
  return a.bytes();
}

function p2sh32(r: Uint8Array): Uint8Array { return new Uint8Array([Op.OP_HASH256, 32, ...hash256(r), Op.OP_EQUAL]); }
function pushRedeem(r: Uint8Array): Uint8Array { return r.length <= 75 ? new Uint8Array([r.length, ...r]) : new Uint8Array([0x4c, r.length, ...r]); }
function push32(d: Uint8Array): Uint8Array { return new Uint8Array([32, ...d]); }
const entryOut = (c: Uint8Array): any => ({ lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 1000n, token: { category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: c } } });

// An off-chain model of the sorted list (what the SDK maintains): slot -> nextKey. Locates the predecessor of k.
class ListModel {
  links = new Map<number, number>([[0, 0]]); // start: HEAD[0|0] (empty set, head -> +infinity)
  predecessorOf(k: number): number {
    let best = 0;
    for (const slot of this.links.keys()) if (slot < k && slot >= best) best = slot;
    return best;
  }

  has(k: number): boolean { return this.links.has(k); }
  insert(k: number): void { const p = this.predecessorOf(k); const s = this.links.get(p)!; this.links.set(p, k); this.links.set(k, s); }
}

// Attempt a claim(k) against the current list; returns the VM verdict. On success also mutates the model.
function claim(model: ListModel, k: number): true | string {
  const cov = claimCovenant();
  const p = model.predecessorOf(k);
  const s = model.links.get(p)!;
  const tx = {
    version: 2,
    inputs: [
      { outpointTransactionHash: hexToBin('00'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([...push32(slot32(k)), ...pushRedeem(cov)]), sequenceNumber: 0xffffffff },
      { outpointTransactionHash: hexToBin('a1'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
    ],
    outputs: [
      { lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 1000n, token: masterToken },
      entryOut(commit(p, k)),   // P' = pred with next rewritten to k
      entryOut(commit(k, s)),   // NEW = k -> old successor
    ],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: p2sh32(cov), valueSatoshis: 4000n, token: masterToken },
    entryOut(commit(p, s)),     // predecessor as it currently is
  ];
  const verdict = createVirtualMachineBch2026().verify({ inputIndex: 0, sourceOutputs, transaction: tx } as any);
  if (verdict === true) model.insert(k);
  return verdict;
}

describe('sorted linked-list mapping: claim-once (C2 end-to-end)', () => {
  it('lets each address claim exactly once; a second claim reverts (no omittable default)', () => {
    const list = new ListModel();
    // A sequence of distinct claimers all succeed, building the sorted list.
    expect(claim(list, 30)).toBe(true);
    expect(claim(list, 70)).toBe(true);
    expect(claim(list, 50)).toBe(true);
    expect(claim(list, 10)).toBe(true);
    expect([...list.links.keys()].sort((a, b) => a - b)).toEqual([0, 10, 30, 50, 70]);

    // Re-claiming any present key reverts: it is present, so no predecessor brackets it.
    expect(claim(list, 30)).not.toBe(true);
    expect(claim(list, 70)).not.toBe(true);
    expect(claim(list, 50)).not.toBe(true);

    // A fresh address can still claim (the guard is sound, not just globally locked).
    expect(claim(list, 90)).toBe(true);
  });

  it('rejects an omission attempt: claiming a present key while pointing at a non-adjacent predecessor', () => {
    const list = new ListModel();
    claim(list, 40);
    claim(list, 60);
    // 40 is present (HEAD[0|40] -> 40[40|60] -> 60[60|0]). To "re-claim" 40 the attacker would need a predecessor
    // P with P.slot < 40 < P.next; the only candidate is HEAD, whose next is exactly 40 -> 40 < 40 fails.
    const cov = claimCovenant();
    const tryReclaim40WithHead = (): true | string => {
      const tx = {
        version: 2,
        inputs: [
          { outpointTransactionHash: hexToBin('00'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([...push32(slot32(40)), ...pushRedeem(cov)]), sequenceNumber: 0xffffffff },
          { outpointTransactionHash: hexToBin('a1'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
        ],
        outputs: [
          { lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 1000n, token: masterToken },
          entryOut(commit(0, 40)), entryOut(commit(40, 40)),
        ],
        locktime: 0,
      };
      const sourceOutputs = [
        { lockingBytecode: p2sh32(cov), valueSatoshis: 4000n, token: masterToken },
        entryOut(commit(0, 40)), // HEAD (its real next is 40)
      ];
      return createVirtualMachineBch2026().verify({ inputIndex: 0, sourceOutputs, transaction: tx } as any);
    };
    expect(tryReclaim40WithHead()).not.toBe(true);
  });
});
