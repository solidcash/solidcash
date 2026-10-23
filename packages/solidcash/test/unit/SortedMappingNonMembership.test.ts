import { describe, it, expect } from 'vitest';
import { createVirtualMachineBch2026, hash256, hexToBin } from '@bitauth/libauth';
import { Op } from '@solidcash/utils';

// vmap fix core: a sound negative guard via a sorted singly-linked list of entry NFTs. Each entry commits
// slot(32) ++ nextKey(32) ++ value. Non-membership of key k is proven by co-spending the bracketing predecessor
// P with P.slot < k < P.nextKey (nextKey 0 = +infinity). This test proves the property that closes vmap: the
// bracket CANNOT be satisfied for a PRESENT key, and a fabricated predecessor fails category authentication - so
// a spender can no longer omit an existing entry to make the guard read the default.

// The contract's category. It is non-palindromic, so the covenant must compare the internal order that
// OP_UTXOTOKENCATEGORY answers with, not the display-order token category on the UTXO. An attacker cannot mint a
// UTXO with this category - it is guarded by the master NFT in the real system.
const CATEGORY = hexToBin('11'.repeat(31) + 'ee');
const CATEGORY_INTERNAL = CATEGORY.slice().reverse();
const WRONG_CATEGORY = hexToBin('22'.repeat(31) + 'dd');

// 32-byte little-endian slot (OP_BIN2NUM reads little-endian). Test slots are small so the top byte is 0 (a
// positive, sign-safe script number); production uses H(key) with an unsigned-safe encoding.
function slot32(n: number): Uint8Array {
  const b = new Uint8Array(32);
  let v = n;
  let i = 0;
  while (v > 0) { b[i++] = v & 0xff; v = Math.floor(v / 256); }
  return b;
}

// entry commitment = slot(32) || nextKey(32) || value(1)
function commitment(slot: number, nextKey: number, value = 1): Uint8Array {
  const out = new Uint8Array(65);
  out.set(slot32(slot), 0);
  out.set(slot32(nextKey), 32);
  out[64] = value;
  return out;
}

// The non-membership covenant (stands in for a contract's `require(!m[k])` check). Stack in: <k>. Co-spends the
// predecessor at input 1. Verifies input1.category base == CATEGORY, then P.slot < k < P.nextKey (nextKey 0 =
// +infinity). Leaves 1 iff k is provably absent. There is NO default-on-absent branch: omitting the witness (or
// presenting a bad one) reverts instead of falling through to "absent".
function buildCovenant(): Uint8Array {
  const b: number[] = [];
  const op = (...xs: number[]): void => { b.push(...xs); };
  const pushData = (data: Uint8Array): void => { b.push(data.length, ...data); };
  // stack: [k]
  op(Op.OP_1, Op.OP_UTXOTOKENCATEGORY);        // [k, cat33]
  pushData(new Uint8Array([32])); op(Op.OP_SPLIT); // [k, cat32, cap]
  op(Op.OP_DROP);                              // [k, cat32]
  pushData(CATEGORY_INTERNAL); op(Op.OP_EQUALVERIFY); // [k] (predecessor is an authenticated entry)
  op(Op.OP_BIN2NUM);                           // [k#]  (k arrives as a 32-byte slot; compare as an unsigned number)
  op(Op.OP_1, Op.OP_UTXOTOKENCOMMITMENT);      // [k#, commit]
  pushData(new Uint8Array([32])); op(Op.OP_SPLIT); // [k, slot32, rest]
  pushData(new Uint8Array([32])); op(Op.OP_SPLIT); // [k, slot32, nextKey32, value]
  op(Op.OP_DROP);                              // [k, slot32, nextKey32]
  op(Op.OP_BIN2NUM);                           // [k, slot32, nextKeyNum]
  op(Op.OP_SWAP, Op.OP_BIN2NUM);               // [k, nextKeyNum, slotNum]
  // lower bound: slotNum < k
  op(Op.OP_2, Op.OP_PICK);                     // [k, nextKeyNum, slotNum, k]
  op(Op.OP_LESSTHAN, Op.OP_VERIFY);            // [k, nextKeyNum]   (verified slot < k)
  // upper bound: nextKeyNum == 0 (+inf) OR k < nextKeyNum
  op(Op.OP_DUP, Op.OP_0, Op.OP_NUMEQUAL);      // [k, nextKeyNum, isInf]
  op(Op.OP_IF);
  op(Op.OP_2DROP, Op.OP_1);                    // +inf -> [1]
  op(Op.OP_ELSE);
  op(Op.OP_LESSTHAN);                          // k < nextKeyNum -> [bool]
  op(Op.OP_ENDIF);
  return new Uint8Array(b);
}

function p2sh32Locking(redeem: Uint8Array): Uint8Array {
  return new Uint8Array([Op.OP_HASH256, 32, ...hash256(redeem), Op.OP_EQUAL]);
}

// minimal script-number push of k (the claimed-absent key). Values 1..16 use OP_1..OP_16 (BCH minimal-push rule).
function pushNum(n: number): Uint8Array {
  if (n === 0) return new Uint8Array([Op.OP_0]);
  if (n >= 1 && n <= 16) return new Uint8Array([0x50 + n]); // OP_1..OP_16
  const b: number[] = [];
  let v = n;
  while (v > 0) { b.push(v & 0xff); v = Math.floor(v / 256); }
  if (b[b.length - 1] & 0x80) b.push(0x00);
  return new Uint8Array([b.length, ...b]);
}

// push a redeem script (data push, OP_PUSHDATA1 when > 75 bytes)
function pushRedeem(redeem: Uint8Array): Uint8Array {
  if (redeem.length <= 75) return new Uint8Array([redeem.length, ...redeem]);
  return new Uint8Array([0x4c, redeem.length, ...redeem]); // OP_PUSHDATA1
}

// Run the guard covenant at input 0, co-spending predecessor P (input 1) with the given category + commitment.
function verifyNonMembership(k: number, predCommitment: Uint8Array, predCategory: Uint8Array): true | string {
  const covenant = buildCovenant();
  const transaction = {
    version: 2,
    inputs: [
      { outpointTransactionHash: hexToBin('00'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([...pushNum(k), ...pushRedeem(covenant)]), sequenceNumber: 0xffffffff },
      { outpointTransactionHash: hexToBin('a1'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
    ],
    outputs: [{ lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 2500n }],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: p2sh32Locking(covenant), valueSatoshis: 2000n },
    {
      lockingBytecode: new Uint8Array([Op.OP_1]),
      valueSatoshis: 1000n,
      token: { category: predCategory, amount: 0n, nft: { capability: 'mutable' as const, commitment: predCommitment } },
    },
  ];
  const vm = createVirtualMachineBch2026();
  return vm.verify({ inputIndex: 0, sourceOutputs, transaction } as any);
}

// 32-byte little-endian from a bigint (production slots are H(key) with the high bit masked -> a positive 255-bit
// script number, so OP_BIN2NUM + OP_LESSTHAN compare them as UNSIGNED). Values here stay below 2^255.
function slotBig(v: bigint): Uint8Array {
  const b = new Uint8Array(32);
  for (let i = 0; i < 32; i++) { b[i] = Number(v & 0xffn); v >>= 8n; }
  return b;
}
function commitBig(slot: bigint, nextKey: bigint): Uint8Array {
  const out = new Uint8Array(65);
  out.set(slotBig(slot), 0); out.set(slotBig(nextKey), 32); out[64] = 1;
  return out;
}
function pushSlot(v: bigint): Uint8Array { return new Uint8Array([32, ...slotBig(v)]); }

// Run non-membership with a full-width 32-byte key + predecessor commitment.
function verifyNonMembershipBig(k: bigint, predCommitment: Uint8Array): true | string {
  const covenant = buildCovenant();
  const transaction = {
    version: 2,
    inputs: [
      { outpointTransactionHash: hexToBin('00'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([...pushSlot(k), ...pushRedeem(covenant)]), sequenceNumber: 0xffffffff },
      { outpointTransactionHash: hexToBin('a1'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
    ],
    outputs: [{ lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 2500n }],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: p2sh32Locking(covenant), valueSatoshis: 2000n },
    { lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 1000n, token: { category: CATEGORY, amount: 0n, nft: { capability: 'mutable' as const, commitment: predCommitment } } },
  ];
  return createVirtualMachineBch2026().verify({ inputIndex: 0, sourceOutputs, transaction } as any);
}

// State (slots): HEAD[0|10] -> A[10|50] -> B[50|90] -> C[90|0(+inf)]
describe('sorted linked-list mapping: non-membership soundness (vmap)', () => {
  const LOW = (2n ** 200n);              // large 32-byte slots (all < 2^255 -> positive, sign-safe)
  const MID = (2n ** 200n) + (2n ** 120n);
  const HIGH = (2n ** 254n) - 1n;        // near-max positive 255-bit slot

  it('full-width 32-byte slots: accepts a valid bracket LOW < MID < HIGH', () => {
    expect(verifyNonMembershipBig(MID, commitBig(LOW, HIGH))).toBe(true);
  });

  it('full-width 32-byte slots: REJECTS a present key at the upper bound (k == nextKey)', () => {
    expect(verifyNonMembershipBig(HIGH, commitBig(LOW, HIGH))).not.toBe(true);
  });

  it('full-width 32-byte slots: REJECTS below the predecessor (k < slot, wrong gap)', () => {
    expect(verifyNonMembershipBig(LOW - 1n, commitBig(LOW, HIGH))).not.toBe(true);
  });

  it('accepts a valid non-membership proof for an absent key (40 in gap 10..50)', () => {
    expect(verifyNonMembership(40, commitment(10, 50), CATEGORY)).toBe(true);
  });

  it('accepts absence below all real keys (5 in head gap 0..10)', () => {
    expect(verifyNonMembership(5, commitment(0, 10), CATEGORY)).toBe(true);
  });

  it('accepts absence above all keys via the +infinity sentinel (200 after 90)', () => {
    expect(verifyNonMembership(200, commitment(90, 0), CATEGORY)).toBe(true);
  });

  it('REJECTS forging non-membership of a PRESENT key via its predecessor (claim 50 absent, P=A[10|50])', () => {
    // A.nextKey == 50, so 50 < 50 (upper bound) is false: no valid bracket for a present key.
    expect(verifyNonMembership(50, commitment(10, 50), CATEGORY)).not.toBe(true);
  });

  it('REJECTS forging non-membership of a PRESENT key via the key entry itself (claim 50 absent, P=B[50|90])', () => {
    // B.slot == 50, so 50 < 50 (lower bound) fails.
    expect(verifyNonMembership(50, commitment(50, 90), CATEGORY)).not.toBe(true);
  });

  it('REJECTS a fabricated predecessor with the wrong category (attacker mints a fake [10|90])', () => {
    // Even a "perfect" bracket 10<50<90 is rejected: the entry is not authenticated as this contract's.
    expect(verifyNonMembership(50, commitment(10, 90), WRONG_CATEGORY)).not.toBe(true);
  });
});
