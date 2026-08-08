/* eslint-disable max-len */
import { describe, it, expect } from 'vitest';
import { createVirtualMachineBch2026, hash256, hexToBin } from '@bitauth/libauth';
import { Op } from '@solidcash/utils';

// The sorted-set READ covenant (what the compiler emits for `m[k]` on a sorted mapping(K=>bool)): co-spend ONE
// entry - the exact entry if present, else the predecessor - and return the REAL membership bit soundly:
//   slot == H(k)                -> present -> 1 (true)
//   slot < H(k) < nextKey       -> absent  -> 0 (false)
//   (no co-spent entry / neither holds) -> revert  (no default-on-absent branch to omit -> closes C2)
// So one covenant answers require(m[k]) AND require(!m[k]) without guard classification, and neither bit can be
// forged: present needs the k-entry (authenticated), absent needs a real bracketing predecessor.

const CATEGORY = hexToBin('11'.repeat(32));
const WRONG = hexToBin('22'.repeat(32));

function slot32(n: number): Uint8Array { const b = new Uint8Array(32); let v = n; let i = 0; while (v > 0) { b[i++] = v & 0xff; v = Math.floor(v / 256); } return b; }
function commit(slot: number, nextKey: number): Uint8Array { const o = new Uint8Array(64); o.set(slot32(slot), 0); o.set(slot32(nextKey), 32); return o; }
class Asm { b: number[] = []; op(...xs: number[]): this { this.b.push(...xs); return this; } push(d: Uint8Array): this { this.b.push(d.length, ...d); return this; } bytes(): Uint8Array { return new Uint8Array(this.b); } }

// Stack in: [expectedBit, Hk32] (Hk32 = H(k) on top). input1 = co-spent entry. Computes the membership bit
// (1 present / 0 absent) or reverts, then OP_NUMEQUAL against expectedBit so the test asserts the exact bit.
// (In real codegen the covenant leaves the bit for the consuming expression; here we pin it.)
function readCovenant(): Uint8Array {
  const a = new Asm();
  a.op(Op.OP_1, Op.OP_UTXOTOKENCATEGORY).push(new Uint8Array([32])).op(Op.OP_SPLIT, Op.OP_DROP).push(CATEGORY).op(Op.OP_EQUALVERIFY); // [Hk32] (entry authentic)
  a.op(Op.OP_1, Op.OP_UTXOTOKENCOMMITMENT).push(new Uint8Array([32])).op(Op.OP_SPLIT).push(new Uint8Array([32])).op(Op.OP_SPLIT, Op.OP_DROP); // [Hk32, slot32, nextKey32]
  // membership: slot32 == Hk32 ?
  a.op(Op.OP_OVER);                          // [Hk32, slot32, nextKey32, slot32]  (copy slot32, depth1)
  a.op(Op.OP_3, Op.OP_PICK, Op.OP_EQUAL);    // [Hk32, slot32, nextKey32, slot==Hk]  (copy Hk32 depth3)
  a.op(Op.OP_IF);
  a.op(Op.OP_2DROP, Op.OP_DROP, Op.OP_1);    // present -> [1]
  a.op(Op.OP_ELSE);
  // absence bracket: slot < Hk < nextKey. stack [Hk32, slot32, nextKey32]
  a.op(Op.OP_OVER, Op.OP_BIN2NUM);           // [Hk32, slot32, nextKey32, slot#]  (copy slot32 depth1)
  a.op(Op.OP_3, Op.OP_PICK, Op.OP_BIN2NUM);  // [.., slot#, Hk#]  (copy Hk32 depth3)
  a.op(Op.OP_LESSTHAN, Op.OP_VERIFY);        // slot < Hk -> [Hk32, slot32, nextKey32]
  a.op(Op.OP_DUP, Op.OP_BIN2NUM, Op.OP_DUP, Op.OP_0, Op.OP_NUMEQUAL); // [.., nextKey#, isInf]
  a.op(Op.OP_IF, Op.OP_DROP);                // +inf ok -> [Hk32, slot32, nextKey32]
  a.op(Op.OP_ELSE);
  a.op(Op.OP_3, Op.OP_PICK, Op.OP_BIN2NUM);  // Hk# (Hk32 depth3) -> [.., nextKey#, Hk#]
  a.op(Op.OP_SWAP, Op.OP_LESSTHAN, Op.OP_VERIFY); // Hk < nextKey -> [Hk32, slot32, nextKey32]
  a.op(Op.OP_ENDIF);
  a.op(Op.OP_2DROP, Op.OP_DROP, Op.OP_0);    // absent -> [0]
  a.op(Op.OP_ENDIF);
  a.op(Op.OP_NUMEQUAL);                       // [expectedBit, bit] -> bit == expectedBit
  return a.bytes();
}

function p2sh32(r: Uint8Array): Uint8Array { return new Uint8Array([Op.OP_HASH256, 32, ...hash256(r), Op.OP_EQUAL]); }
function pushRedeem(r: Uint8Array): Uint8Array { return r.length <= 75 ? new Uint8Array([r.length, ...r]) : new Uint8Array([0x4c, r.length, ...r]); }
function push32(d: Uint8Array): Uint8Array { return new Uint8Array([32, ...d]); }

// Assert the covenant computes membership bit == expectedBit (1 present / 0 absent); 'REVERT' if it reverts.
function read(hk: number, entryCommit: Uint8Array, expectedBit: 0 | 1, category = CATEGORY): string {
  const cov = readCovenant();
  const expPush = expectedBit === 1 ? new Uint8Array([Op.OP_1]) : new Uint8Array([Op.OP_0]);
  const tx = {
    version: 2,
    inputs: [
      { outpointTransactionHash: hexToBin('00'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([...expPush, ...push32(slot32(hk)), ...pushRedeem(cov)]), sequenceNumber: 0xffffffff },
      { outpointTransactionHash: hexToBin('a1'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
    ],
    outputs: [{ lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 2500n }],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: p2sh32(cov), valueSatoshis: 3000n },
    { lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 1000n, token: { category, amount: 0n, nft: { capability: 'mutable' as const, commitment: entryCommit } } },
  ];
  const res = createVirtualMachineBch2026().verify({ inputIndex: 0, sourceOutputs, transaction: tx } as any);
  return res === true ? 'OK' : 'REVERT';
}

// State: HEAD[0|10] -> A[10|50] -> B[50|90] -> C[90|0]
describe('sorted-set read covenant (membership-or-non-membership, C2)', () => {
  it('present key -> co-spend its entry (slot==H(k)) -> bit is 1 (true)', () => {
    expect(read(50, commit(50, 90), 1)).toBe('OK'); // B, slot==50
    expect(read(50, commit(50, 90), 0)).toBe('REVERT'); // the bit is really 1, not 0
  });
  it('absent key -> co-spend the predecessor (slot<H(k)<nextKey) -> bit is 0 (false)', () => {
    expect(read(40, commit(10, 50), 0)).toBe('OK'); // A brackets 40
    expect(read(40, commit(10, 50), 1)).toBe('REVERT'); // the bit is really 0, not 1
  });
  it('absent above the tail via +infinity -> bit is 0', () => {
    expect(read(200, commit(90, 0), 0)).toBe('OK'); // C[90|0]
  });
  it('REVERTS forging absence of a PRESENT key (predecessor A[10|50] does not bracket 50)', () => {
    expect(read(50, commit(10, 50), 0)).toBe('REVERT'); // slot 10<50 but nextKey 50, 50<50 false
    expect(read(50, commit(10, 50), 1)).toBe('REVERT'); // and it is not the exact entry either
  });
  it('REVERTS a co-spent entry that neither equals nor brackets the key (wrong gap)', () => {
    expect(read(40, commit(50, 90), 0)).toBe('REVERT'); // 50<40 false
  });
  it('REVERTS a fabricated entry (wrong category) even with a perfect bracket', () => {
    expect(read(40, commit(10, 50), 0, WRONG)).toBe('REVERT');
  });
});
