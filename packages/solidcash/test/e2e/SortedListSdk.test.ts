import { describe, it, expect } from 'vitest';
import { createVirtualMachineBch2026, hash256, hexToBin, binToHex } from '@bitauth/libauth';
import { Op } from '@solidcash/utils';
import {
  SortedList, keyToSlot, keyToSlotValue, slotValueToBytes, bytesToSlotValue,
  encodeEntryCommitment, decodeEntryCommitment, headSentinelCommitment,
} from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';

// SDK part of the C2 sorted-linked-list mapping: the off-chain list manager (rebuild from chain, predecessor
// lookup, insert/delete/read co-spend plans). Verified two ways: (1) unit checks of slot hashing / codec /
// planning; (2) end-to-end - the SDK's plans, fed into the VM-PROVEN covenants, produce transactions the VM
// accepts (and a plan for a present/absent key is refused). Covenants proven in SortedMapping*.test.ts.

const CATEGORY = '11'.repeat(32);
const masterToken = { category: hexToBin(CATEGORY), amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array([]) } };

class Asm { b: number[] = []; op(...xs: number[]): this { this.b.push(...xs); return this; } pushData(d: Uint8Array): this { this.b.push(d.length, ...d); return this; } bytes(): Uint8Array { return new Uint8Array(this.b); } }

// The VM-proven INSERT covenant (from SortedMappingInsertDelete.test.ts). Stack in: [k32]. input1 = predecessor.
function insertCovenant(): Uint8Array {
  const a = new Asm();
  const cat = hexToBin(CATEGORY);
  const catBase = (idx: number, opCat: number): void => { a.op(idx, opCat).pushData(new Uint8Array([32])).op(Op.OP_SPLIT, Op.OP_DROP).pushData(cat).op(Op.OP_EQUALVERIFY); };
  catBase(Op.OP_1, Op.OP_UTXOTOKENCATEGORY);
  a.op(Op.OP_1, Op.OP_UTXOTOKENCOMMITMENT).pushData(new Uint8Array([32])).op(Op.OP_SPLIT);
  a.op(Op.OP_OVER, Op.OP_BIN2NUM); a.op(Op.OP_3, Op.OP_PICK, Op.OP_BIN2NUM); a.op(Op.OP_LESSTHAN, Op.OP_VERIFY);
  a.op(Op.OP_DUP, Op.OP_BIN2NUM, Op.OP_DUP, Op.OP_0, Op.OP_NUMEQUAL);
  a.op(Op.OP_IF); a.op(Op.OP_DROP);
  a.op(Op.OP_ELSE); a.op(Op.OP_3, Op.OP_PICK, Op.OP_BIN2NUM); a.op(Op.OP_SWAP, Op.OP_LESSTHAN, Op.OP_VERIFY); a.op(Op.OP_ENDIF);
  catBase(Op.OP_1, Op.OP_OUTPUTTOKENCATEGORY);
  a.op(Op.OP_OVER); a.op(Op.OP_3, Op.OP_PICK, Op.OP_CAT); a.op(Op.OP_1, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY);
  catBase(Op.OP_2, Op.OP_OUTPUTTOKENCATEGORY);
  a.op(Op.OP_2, Op.OP_PICK); a.op(Op.OP_1, Op.OP_PICK, Op.OP_CAT); a.op(Op.OP_2, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY);
  a.op(Op.OP_2DROP, Op.OP_DROP, Op.OP_1);
  return a.bytes();
}

// The VM-proven NON-MEMBERSHIP covenant. Stack in: [k32]. input1 = predecessor.
function nonMembershipCovenant(): Uint8Array {
  const a = new Asm();
  const cat = hexToBin(CATEGORY);
  a.op(Op.OP_1, Op.OP_UTXOTOKENCATEGORY).pushData(new Uint8Array([32])).op(Op.OP_SPLIT, Op.OP_DROP).pushData(cat).op(Op.OP_EQUALVERIFY);
  a.op(Op.OP_BIN2NUM);
  a.op(Op.OP_1, Op.OP_UTXOTOKENCOMMITMENT).pushData(new Uint8Array([32])).op(Op.OP_SPLIT).pushData(new Uint8Array([32])).op(Op.OP_SPLIT, Op.OP_DROP);
  a.op(Op.OP_BIN2NUM).op(Op.OP_SWAP, Op.OP_BIN2NUM);
  a.op(Op.OP_2, Op.OP_PICK, Op.OP_LESSTHAN, Op.OP_VERIFY);
  a.op(Op.OP_DUP, Op.OP_0, Op.OP_NUMEQUAL);
  a.op(Op.OP_IF); a.op(Op.OP_2DROP, Op.OP_1);
  a.op(Op.OP_ELSE); a.op(Op.OP_LESSTHAN); a.op(Op.OP_ENDIF);
  return a.bytes();
}

// The VM-proven DELETE covenant. input1 = P[Ps|k], input2 = node[k|S], output1 = P'[Ps|S].
function deleteCovenant(): Uint8Array {
  const a = new Asm();
  const cat = hexToBin(CATEGORY);
  const catBase = (idx: number, opCat: number): void => { a.op(idx, opCat).pushData(new Uint8Array([32])).op(Op.OP_SPLIT, Op.OP_DROP).pushData(cat).op(Op.OP_EQUALVERIFY); };
  catBase(Op.OP_1, Op.OP_UTXOTOKENCATEGORY);
  a.op(Op.OP_1, Op.OP_UTXOTOKENCOMMITMENT).pushData(new Uint8Array([32])).op(Op.OP_SPLIT);
  a.op(Op.OP_2, Op.OP_PICK, Op.OP_EQUALVERIFY);
  catBase(Op.OP_2, Op.OP_UTXOTOKENCATEGORY);
  a.op(Op.OP_2, Op.OP_UTXOTOKENCOMMITMENT).pushData(new Uint8Array([32])).op(Op.OP_SPLIT);
  a.op(Op.OP_SWAP); a.op(Op.OP_3, Op.OP_PICK, Op.OP_EQUALVERIFY);
  catBase(Op.OP_1, Op.OP_OUTPUTTOKENCATEGORY);
  a.op(Op.OP_OVER); a.op(Op.OP_1, Op.OP_PICK, Op.OP_CAT); a.op(Op.OP_1, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY);
  a.op(Op.OP_2DROP, Op.OP_DROP, Op.OP_1);
  return a.bytes();
}

// The VM-proven UPDATE covenant. input1 = entry[k|S|Vold], output1 = entry'[k|S|Vnew] (link preserved).
function updateCovenant(): Uint8Array {
  const a = new Asm();
  const cat = hexToBin(CATEGORY);
  a.op(Op.OP_1, Op.OP_UTXOTOKENCATEGORY).pushData(new Uint8Array([32])).op(Op.OP_SPLIT, Op.OP_DROP).pushData(cat).op(Op.OP_EQUALVERIFY);
  a.op(Op.OP_1, Op.OP_UTXOTOKENCOMMITMENT).pushData(new Uint8Array([64])).op(Op.OP_SPLIT, Op.OP_DROP);
  a.op(Op.OP_DUP).pushData(new Uint8Array([32])).op(Op.OP_SPLIT, Op.OP_DROP);
  a.op(Op.OP_2, Op.OP_PICK, Op.OP_EQUALVERIFY);
  a.op(Op.OP_1, Op.OP_OUTPUTTOKENCATEGORY).pushData(new Uint8Array([32])).op(Op.OP_SPLIT, Op.OP_DROP).pushData(cat).op(Op.OP_EQUALVERIFY);
  a.op(Op.OP_1, Op.OP_OUTPUTTOKENCOMMITMENT).pushData(new Uint8Array([64])).op(Op.OP_SPLIT, Op.OP_DROP);
  a.op(Op.OP_EQUALVERIFY);
  a.op(Op.OP_DROP, Op.OP_1);
  return a.bytes();
}

function p2sh32(r: Uint8Array): Uint8Array { return new Uint8Array([Op.OP_HASH256, 32, ...hash256(r), Op.OP_EQUAL]); }
function pushRedeem(r: Uint8Array): Uint8Array { return r.length <= 75 ? new Uint8Array([r.length, ...r]) : new Uint8Array([0x4c, r.length, ...r]); }
function push32(d: Uint8Array): Uint8Array { return new Uint8Array([32, ...d]); }

// Build an SDK Utxo for an entry NFT with the given commitment bytes.
function entryUtxo(txid: string, commitment: Uint8Array): Utxo {
  return { txid, vout: 0, satoshis: 1000n, token: { category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(commitment) } } };
}
// libauth source output for an entry Utxo.
function entrySrc(u: Utxo): any {
  return { lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: u.satoshis, token: { category: hexToBin(u.token!.category), amount: 0n, nft: { capability: 'mutable', commitment: hexToBin(u.token!.nft!.commitment) } } };
}
const entryOut = (c: Uint8Array): any => ({ lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 1000n, token: { category: hexToBin(CATEGORY), amount: 0n, nft: { capability: 'mutable', commitment: c } } });

// Build a list state HEAD[0|10] -> A[10|50] -> B[50|90] -> C[90|0] as on-chain entry UTXOs.
function sampleUtxos(): Utxo[] {
  const s = (n: number): Uint8Array => slotValueToBytes(BigInt(n));
  return [
    entryUtxo('00'.repeat(32), encodeEntryCommitment(s(0), s(10))),
    entryUtxo('0a'.repeat(32), encodeEntryCommitment(s(10), s(50))),
    entryUtxo('50'.repeat(32), encodeEntryCommitment(s(50), s(90))),
    entryUtxo('90'.repeat(32), encodeEntryCommitment(s(90), s(0))),
  ];
}

describe('SortedList SDK: slot hashing + commitment codec', () => {
  it('keyToSlot is deterministic, 32 bytes, and a positive (masked) 255-bit value', () => {
    const slot = keyToSlot(hexToBin('deadbeef'));
    expect(slot.length).toBe(32);
    expect(keyToSlotValue(hexToBin('deadbeef'))).toBe(bytesToSlotValue(slot));
    expect(bytesToSlotValue(slot) < (1n << 255n)).toBe(true); // high bit masked -> sign-safe for OP_LESSTHAN
    expect(binToHex(keyToSlot(hexToBin('deadbeef')))).toBe(binToHex(slot)); // deterministic
  });

  it('encode/decode entry commitment round-trips', () => {
    const slot = slotValueToBytes(123n); const next = slotValueToBytes(456n); const val = hexToBin('cafe');
    const { slot: s, nextKey: n, value: v } = decodeEntryCommitment(encodeEntryCommitment(slot, next, val));
    expect(binToHex(s)).toBe(binToHex(slot));
    expect(binToHex(n)).toBe(binToHex(next));
    expect(binToHex(v)).toBe('cafe');
  });
});

describe('SortedList SDK: rebuild from chain + predecessor lookup', () => {
  const list = SortedList.fromUtxos(sampleUtxos());
  const s = (n: number): Uint8Array => slotValueToBytes(BigInt(n));

  it('rebuilds the sorted list from entry UTXOs', () => {
    expect(list.all.map((e) => Number(bytesToSlotValue(e.slot)))).toEqual([0, 10, 50, 90]);
  });
  it('has()/find() report presence', () => {
    expect(list.has(s(50))).toBe(true);
    expect(list.has(s(40))).toBe(false);
  });
  it('predecessorOf finds the bracketing predecessor', () => {
    expect(Number(bytesToSlotValue(list.predecessorOf(s(40)).slot))).toBe(10); // 10 < 40 < 50
    expect(Number(bytesToSlotValue(list.predecessorOf(s(5)).slot))).toBe(0);   // head gap
    expect(Number(bytesToSlotValue(list.predecessorOf(s(200)).slot))).toBe(90); // after tail
  });
  it('refuses impossible proofs', () => {
    expect(() => list.planNonMembership(s(50))).toThrow(); // present -> no non-membership
    expect(() => list.planMembership(s(40))).toThrow();    // absent -> no membership
    expect(() => list.planInsert(s(50))).toThrow();        // present -> use update
    expect(() => list.planDelete(s(40))).toThrow();        // absent -> nothing to delete
  });
});

describe('SortedList SDK: plans satisfy the proven covenants (end to end)', () => {
  const s = (n: number): Uint8Array => slotValueToBytes(BigInt(n));

  it('a planInsert transaction is accepted by the proven insert covenant', () => {
    const list = SortedList.fromUtxos(sampleUtxos());
    const plan = list.planInsert(s(40));
    // The plan tells us the predecessor to co-spend and the two output commitments to create.
    expect(Number(bytesToSlotValue(plan.predecessor.slot))).toBe(10);
    const cov = insertCovenant();
    const tx = {
      version: 2,
      inputs: [
        { outpointTransactionHash: hexToBin('ff'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([...push32(plan.slot), ...pushRedeem(cov)]), sequenceNumber: 0xffffffff },
        { outpointTransactionHash: hexToBin(plan.predecessor.utxo.txid), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
      ],
      outputs: [
        { lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 1000n, token: masterToken },
        entryOut(plan.predNewCommitment),
        entryOut(plan.newNodeCommitment),
      ],
      locktime: 0,
    };
    const sourceOutputs = [
      { lockingBytecode: p2sh32(cov), valueSatoshis: 4000n, token: masterToken },
      entrySrc(plan.predecessor.utxo),
    ];
    expect(createVirtualMachineBch2026().verify({ inputIndex: 0, sourceOutputs, transaction: tx } as any)).toBe(true);
  });

  it('a planNonMembership transaction is accepted by the proven non-membership covenant', () => {
    const list = SortedList.fromUtxos(sampleUtxos());
    const plan = list.planNonMembership(s(40));
    const cov = nonMembershipCovenant();
    const tx = {
      version: 2,
      inputs: [
        { outpointTransactionHash: hexToBin('ff'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([...push32(plan.slot), ...pushRedeem(cov)]), sequenceNumber: 0xffffffff },
        { outpointTransactionHash: hexToBin(plan.predecessor.utxo.txid), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
      ],
      outputs: [{ lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 2500n }],
      locktime: 0,
    };
    const sourceOutputs = [
      { lockingBytecode: p2sh32(cov), valueSatoshis: 3000n },
      entrySrc(plan.predecessor.utxo),
    ];
    expect(createVirtualMachineBch2026().verify({ inputIndex: 0, sourceOutputs, transaction: tx } as any)).toBe(true);
  });

  it('a planDelete transaction is accepted by the proven delete covenant', () => {
    const list = SortedList.fromUtxos(sampleUtxos());
    const plan = list.planDelete(s(50)); // pred A[10|50], node B[50|90] -> A'[10|90]
    expect(Number(bytesToSlotValue(plan.predecessor.slot))).toBe(10);
    expect(Number(bytesToSlotValue(plan.node.slot))).toBe(50);
    const cov = deleteCovenant();
    const tx = {
      version: 2,
      inputs: [
        { outpointTransactionHash: hexToBin('ff'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([...push32(plan.slot), ...pushRedeem(cov)]), sequenceNumber: 0xffffffff },
        { outpointTransactionHash: hexToBin(plan.predecessor.utxo.txid), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
        { outpointTransactionHash: hexToBin(plan.node.utxo.txid), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
      ],
      outputs: [
        { lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 1000n, token: masterToken },
        entryOut(plan.predNewCommitment),
      ],
      locktime: 0,
    };
    const sourceOutputs = [
      { lockingBytecode: p2sh32(cov), valueSatoshis: 4000n, token: masterToken },
      entrySrc(plan.predecessor.utxo),
      entrySrc(plan.node.utxo),
    ];
    expect(createVirtualMachineBch2026().verify({ inputIndex: 0, sourceOutputs, transaction: tx } as any)).toBe(true);
  });

  it('a planUpdate transaction is accepted by the proven update covenant (link preserved, value changed)', () => {
    // A value-carrying entry [50|90|07]; update to value 09.
    const withVal = [entryUtxo('50'.repeat(32), encodeEntryCommitment(s(50), s(90), hexToBin('07')))];
    const plan = SortedList.fromUtxos(withVal).planUpdate(s(50), hexToBin('09'));
    expect(binToHex(decodeEntryCommitment(plan.newCommitment).value)).toBe('09');
    expect(Number(bytesToSlotValue(decodeEntryCommitment(plan.newCommitment).nextKey))).toBe(90); // link preserved
    const cov = updateCovenant();
    const tx = {
      version: 2,
      inputs: [
        { outpointTransactionHash: hexToBin('ff'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([...push32(plan.slot), ...pushRedeem(cov)]), sequenceNumber: 0xffffffff },
        { outpointTransactionHash: hexToBin(plan.entry.utxo.txid), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
      ],
      outputs: [
        { lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 1000n, token: masterToken },
        entryOut(plan.newCommitment),
      ],
      locktime: 0,
    };
    const sourceOutputs = [
      { lockingBytecode: p2sh32(cov), valueSatoshis: 4000n, token: masterToken },
      entrySrc(plan.entry.utxo),
    ];
    expect(createVirtualMachineBch2026().verify({ inputIndex: 0, sourceOutputs, transaction: tx } as any)).toBe(true);
  });

  it('chained inserts: after applying one plan, the next plan uses the updated predecessor', () => {
    // Start empty (HEAD[0|0]); claim 30, then 70, then 50; the SDK tracks the evolving list.
    let utxos: Utxo[] = [entryUtxo('00'.repeat(32), headSentinelCommitment())];
    const apply = (k: number): void => {
      const list = SortedList.fromUtxos(utxos);
      const plan = list.planInsert(s(k));
      // simulate the mined tx: predecessor UTXO replaced by P', plus the NEW node.
      utxos = utxos.filter((u) => u.txid !== plan.predecessor.utxo.txid);
      utxos.push(entryUtxo(`p${k}`.padEnd(64, '0'), plan.predNewCommitment));
      utxos.push(entryUtxo(`n${k}`.padEnd(64, '0'), plan.newNodeCommitment));
    };
    apply(30); apply(70); apply(50);
    const final = SortedList.fromUtxos(utxos);
    expect(final.all.map((e) => Number(bytesToSlotValue(e.slot)))).toEqual([0, 30, 50, 70]);
    // Each present key now correctly links to the next.
    expect(Number(bytesToSlotValue(final.find(s(30))!.nextKey))).toBe(50);
    expect(Number(bytesToSlotValue(final.find(s(50))!.nextKey))).toBe(70);
    expect(Number(bytesToSlotValue(final.find(s(70))!.nextKey))).toBe(0); // tail
    // Re-claiming a present key is refused off-chain (and the covenant would reject it on-chain).
    expect(() => final.planInsert(s(30))).toThrow();
  });
});
