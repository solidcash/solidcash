import { describe, it, expect } from 'vitest';
import { createVirtualMachineBch2026, hash256, hexToBin } from '@bitauth/libauth';
import { Op } from '@solidcash/utils';

// C2 write soundness: inserting/deleting a key in the sorted linked list must produce exactly the correct splice.
// Entries here are value-less (key -> presence, the claim-once / blacklist shape): commitment = slot(32) ++
// nextKey(32). Insert k into gap (P, S=P.next): consume P, emit P'[Ps|k] and NEW[k|S]. Delete k: consume P[Ps|k]
// and k[k|S], emit P'[Ps|S]. The covenant forces every field, so an attacker cannot skip a node, corrupt the
// predecessor, or insert a present key. Entries authenticated by category == the contract's (master-guarded).

const CATEGORY = hexToBin('11'.repeat(32));

function slot32(n: number): Uint8Array {
  const b = new Uint8Array(32);
  let v = n; let i = 0;
  while (v > 0) { b[i++] = v & 0xff; v = Math.floor(v / 256); }
  return b;
}
function commit(slot: number, nextKey: number): Uint8Array {
  const out = new Uint8Array(64);
  out.set(slot32(slot), 0);
  out.set(slot32(nextKey), 32);
  return out;
}

// Assembler helper.
class Asm {
  b: number[] = [];
  op(...xs: number[]): this { this.b.push(...xs); return this; }
  pushData(d: Uint8Array): this { this.b.push(d.length, ...d); return this; }
  bytes(): Uint8Array { return new Uint8Array(this.b); }
}

// INSERT covenant. Stack in: [k32]. input1 = predecessor P[Ps|S]. output1 = P'[Ps|k]. output2 = NEW[k|S].
// Verifies: P authentic; Ps < k < S (k absent); output1 == P with next rewritten to k, at the same category;
// output2 == new node [k|S] at the same category. Every 32-byte field is pinned, so the splice is forced.
function insertCovenant(): Uint8Array {
  const a = new Asm();
  const catBase = (opCat: number): void => { // <n> OP_x-CATEGORY <32> SPLIT DROP <C> EQUALVERIFY
    a.op(opCat).pushData(new Uint8Array([32])).op(Op.OP_SPLIT, Op.OP_DROP).pushData(CATEGORY).op(Op.OP_EQUALVERIFY);
  };
  // [k32]
  a.op(Op.OP_1); catBase(Op.OP_UTXOTOKENCATEGORY);           // [k32]  (P authentic)
  a.op(Op.OP_1, Op.OP_UTXOTOKENCOMMITMENT).pushData(new Uint8Array([32])).op(Op.OP_SPLIT); // [k32, Ps32, S32]
  // bracket Ps < k:
  a.op(Op.OP_OVER, Op.OP_BIN2NUM);          // [k32, Ps32, S32, Ps#]
  a.op(Op.OP_3, Op.OP_PICK, Op.OP_BIN2NUM); // [k32, Ps32, S32, Ps#, k#]
  a.op(Op.OP_LESSTHAN, Op.OP_VERIFY);       // [k32, Ps32, S32]  (Ps < k)
  // bracket k < S, or S==0 (+inf):
  a.op(Op.OP_DUP, Op.OP_BIN2NUM, Op.OP_DUP, Op.OP_0, Op.OP_NUMEQUAL); // [k32, Ps32, S32, S#, isInf]
  a.op(Op.OP_IF);
  a.op(Op.OP_DROP);                         // [k32, Ps32, S32]  (+inf ok)
  a.op(Op.OP_ELSE);
  a.op(Op.OP_3, Op.OP_PICK, Op.OP_BIN2NUM); // [k32, Ps32, S32, S#, k#]
  a.op(Op.OP_SWAP, Op.OP_LESSTHAN, Op.OP_VERIFY); // [k32, Ps32, S32]  (k < S)
  a.op(Op.OP_ENDIF);
  // stack: [k32, Ps32, S32]
  // output1 (P') category == CATEGORY, commitment == Ps32 ++ k32
  a.op(Op.OP_1); catBase(Op.OP_OUTPUTTOKENCATEGORY);        // [k32, Ps32, S32]
  a.op(Op.OP_OVER);                         // [k32, Ps32, S32, Ps32]  (copy Ps32, depth1)
  a.op(Op.OP_3, Op.OP_PICK, Op.OP_CAT);     // [k32, Ps32, S32, Ps32++k32]  (copy k32 depth3, P'.next = k)
  a.op(Op.OP_1, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY); // [k32, Ps32, S32]
  // output2 (NEW) category == CATEGORY, commitment == k32 ++ S32
  a.op(Op.OP_2); catBase(Op.OP_OUTPUTTOKENCATEGORY);        // [k32, Ps32, S32]
  a.op(Op.OP_2, Op.OP_PICK);                // [k32, Ps32, S32, k32]  (copy k32, depth2 -> NEW slot)
  a.op(Op.OP_1, Op.OP_PICK, Op.OP_CAT);     // [k32, Ps32, S32, k32++S32]  (copy S32 depth1, NEW.next = S)
  a.op(Op.OP_2, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY); // [k32, Ps32, S32]
  a.op(Op.OP_2DROP, Op.OP_DROP, Op.OP_1);   // clean -> [1]
  return a.bytes();
}

// DELETE covenant. Stack in: [k32]. input1 = predecessor P[Ps|k] (P.next == k). input2 = the node k[k|S].
// output1 = P'[Ps|S]. Verifies P and node authentic and adjacent (P.next == k == node.slot), and P' splices k out
// (P'.slot = Ps, P'.next = node.next = S). The removed node is consumed (not recreated).
function deleteCovenant(): Uint8Array {
  const a = new Asm();
  const catBase = (idx: number, opCat: number): void => {
    a.op(idx, opCat).pushData(new Uint8Array([32])).op(Op.OP_SPLIT, Op.OP_DROP).pushData(CATEGORY).op(Op.OP_EQUALVERIFY);
  };
  // [k32]
  catBase(Op.OP_1, Op.OP_UTXOTOKENCATEGORY);                 // [k32]  (P authentic)
  a.op(Op.OP_1, Op.OP_UTXOTOKENCOMMITMENT).pushData(new Uint8Array([32])).op(Op.OP_SPLIT); // [k32, Ps32, Pn32]
  a.op(Op.OP_2, Op.OP_PICK, Op.OP_EQUALVERIFY);              // [k32, Ps32]  (P.next == k)
  catBase(Op.OP_2, Op.OP_UTXOTOKENCATEGORY);                 // [k32, Ps32]  (node authentic)
  a.op(Op.OP_2, Op.OP_UTXOTOKENCOMMITMENT).pushData(new Uint8Array([32])).op(Op.OP_SPLIT); // [k32, Ps32, nodeSlot32, S32]
  a.op(Op.OP_SWAP);                                          // [k32, Ps32, S32, nodeSlot32]
  a.op(Op.OP_3, Op.OP_PICK, Op.OP_EQUALVERIFY);              // [k32, Ps32, S32]  (node.slot == k)
  // output1 P' == [Ps32|S32], category C
  catBase(Op.OP_1, Op.OP_OUTPUTTOKENCATEGORY);              // [k32, Ps32, S32]
  a.op(Op.OP_OVER);                                          // [k32, Ps32, S32, Ps32]
  a.op(Op.OP_1, Op.OP_PICK, Op.OP_CAT);                      // [k32, Ps32, S32, Ps32++S32]
  a.op(Op.OP_1, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY); // [k32, Ps32, S32]
  a.op(Op.OP_2DROP, Op.OP_DROP, Op.OP_1);                    // [1]
  return a.bytes();
}

// Run DELETE: input0 = guard(delete covenant + master); input1 = P[Ps|k]; input2 = node[k|S]. outputs: [master, P'].
function runDelete(k: number, pComm: Uint8Array, nodeComm: Uint8Array, out1: Uint8Array): true | string {
  const cov = deleteCovenant();
  const tx = {
    version: 2,
    inputs: [
      { outpointTransactionHash: hexToBin('00'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([...push32(slot32(k)), ...pushRedeem(cov)]), sequenceNumber: 0xffffffff },
      { outpointTransactionHash: hexToBin('a1'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
      { outpointTransactionHash: hexToBin('b2'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
    ],
    outputs: [
      { lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 1000n, token: masterToken },
      entryOut(out1),
    ],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: p2sh32(cov), valueSatoshis: 4000n, token: masterToken },
    entryOut(pComm),
    entryOut(nodeComm),
  ];
  return createVirtualMachineBch2026().verify({ inputIndex: 0, sourceOutputs, transaction: tx } as any);
}

function p2sh32(redeem: Uint8Array): Uint8Array {
  return new Uint8Array([Op.OP_HASH256, 32, ...hash256(redeem), Op.OP_EQUAL]);
}
function pushRedeem(r: Uint8Array): Uint8Array {
  return r.length <= 75 ? new Uint8Array([r.length, ...r]) : new Uint8Array([0x4c, r.length, ...r]);
}
function push32(d: Uint8Array): Uint8Array { return new Uint8Array([32, ...d]); }

const entryOut = (c: Uint8Array): any => ({
  lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 1000n,
  token: { category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: c } },
});

// A minting NFT of CATEGORY (the master) - co-spent so the new entry NFT can be minted (token validation).
const masterToken = { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array([]) } };

// Run INSERT: input0 = guard(covenant + master minting NFT, unlock pushes k32); input1 = P. outputs: [master, P', NEW].
function runInsert(k: number, pComm: Uint8Array, out1: Uint8Array, out2: Uint8Array): true | string {
  const cov = insertCovenant();
  const tx = {
    version: 2,
    inputs: [
      { outpointTransactionHash: hexToBin('00'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([...push32(slot32(k)), ...pushRedeem(cov)]), sequenceNumber: 0xffffffff },
      { outpointTransactionHash: hexToBin('a1'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
    ],
    outputs: [
      { lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 1000n, token: masterToken }, // master preserved
      entryOut(out1),
      entryOut(out2),
    ],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: p2sh32(cov), valueSatoshis: 4000n, token: masterToken },
    entryOut(pComm),
  ];
  return createVirtualMachineBch2026().verify({ inputIndex: 0, sourceOutputs, transaction: tx } as any);
}

// State: HEAD[0|10] -> A[10|50] -> B[50|90] -> C[90|0]
describe('sorted linked-list mapping: insert splice soundness', () => {
  it('accepts inserting an absent key (40 into gap A[10|50]) with the correct splice', () => {
    // P=A[10|50] -> P'=A'[10|40], NEW=[40|50]
    expect(runInsert(40, commit(10, 50), commit(10, 40), commit(40, 50))).toBe(true);
  });

  it('REJECTS a skip-node attack (NEW.next != S: claims [40|90] to drop B from the list)', () => {
    expect(runInsert(40, commit(10, 50), commit(10, 40), commit(40, 90))).not.toBe(true);
  });

  it("REJECTS corrupting the predecessor (P'.slot changed to 0)", () => {
    expect(runInsert(40, commit(10, 50), commit(0, 40), commit(40, 50))).not.toBe(true);
  });

  it('REJECTS P.next not rewritten to k (P\' still points at S=50)', () => {
    expect(runInsert(40, commit(10, 50), commit(10, 50), commit(40, 50))).not.toBe(true);
  });

  it('REJECTS inserting a PRESENT key (50 is B; bracket 10<50<50 fails)', () => {
    expect(runInsert(50, commit(10, 50), commit(10, 50), commit(50, 50))).not.toBe(true);
  });

  it('accepts inserting after the tail via +infinity (200 into gap C[90|0])', () => {
    expect(runInsert(200, commit(90, 0), commit(90, 200), commit(200, 0))).toBe(true);
  });
});

describe('sorted linked-list mapping: delete splice soundness', () => {
  it('accepts deleting a present key (50=B, pred A[10|50], node B[50|90]) -> A\'[10|90]', () => {
    expect(runDelete(50, commit(10, 50), commit(50, 90), commit(10, 90))).toBe(true);
  });

  it("REJECTS leaving a dangling link (P'.next != node.next: claims A'[10|50] keeping the removed key)", () => {
    expect(runDelete(50, commit(10, 50), commit(50, 90), commit(10, 50))).not.toBe(true);
  });

  it('REJECTS a non-adjacent predecessor (P.next != k: HEAD[0|10] is not the predecessor of 50)', () => {
    expect(runDelete(50, commit(0, 10), commit(50, 90), commit(0, 90))).not.toBe(true);
  });

  it('REJECTS co-spending the wrong node (node.slot != k: C[90|0] is not key 50)', () => {
    expect(runDelete(50, commit(10, 50), commit(90, 0), commit(10, 0))).not.toBe(true);
  });

  it("REJECTS corrupting the predecessor slot (P'.slot changed to 0)", () => {
    expect(runDelete(50, commit(10, 50), commit(50, 90), commit(0, 90))).not.toBe(true);
  });
});
