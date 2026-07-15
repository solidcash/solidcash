import { describe, it, expect } from 'vitest';
import { createVirtualMachineBch2026, hash256, hexToBin, binToHex, encodeTransaction } from '@bitauth/libauth';
import {
  Op, buildEntryNftCovenantScript, computeCollectionHash, computeCollectionSignature, scriptToBytecode,
} from '@solidcash/utils';
import { SortedList, slotValueToBytes, encodeEntryCommitment, bytesToSlotValue, decodeEntryCommitment } from '../../src/index.js';
import { MockNetworkProvider } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';

// Full-transaction composition: an insert into a sorted-linked-list mapping, verified with EVERY input running its
// real covenant - the contract (master) covenant does master self-preservation + the insert splice + pins the P'
// and NEW outputs at the entry address; the predecessor input runs the REAL entry-NFT covenant (write path, which
// authenticates the co-spent master); and a funder pays the fee. Proves the SortedList plan assembles into a
// transaction the whole VM accepts (not just the contract input in isolation), and that a present-key re-insert is
// rejected by the composed covenants. Category is fixed here so the entry address is known; the compiler derives
// it at runtime from the co-spent master (emitP2sh32FromCovenant).

const CATEGORY = hexToBin('11'.repeat(32)); // palindromic: display == internal
const COLLECTION_HASH = computeCollectionHash(computeCollectionSignature('claimed', 'mapping(int256 => bool)'));
const ENTRY_REDEEM = scriptToBytecode(buildEntryNftCovenantScript(CATEGORY, COLLECTION_HASH));
const ENTRY_P2SH = new Uint8Array([Op.OP_HASH256, 32, ...hash256(ENTRY_REDEEM), Op.OP_EQUAL]);

class Asm { b: number[] = []; op(...xs: number[]): this { this.b.push(...xs); return this; } push(d: Uint8Array): this { this.b.push(d.length, ...d); return this; } bytes(): Uint8Array { return new Uint8Array(this.b); } }

// The contract (master) covenant for `claim(k)` == insert. Stack in: [k32]. input0 = master (this). input1 =
// predecessor entry. output0 = master' (preserved), output1 = P'[Ps|k], output2 = NEW[k|S], both at ENTRY_P2SH.
function contractCovenant(): Uint8Array {
  const a = new Asm();
  // master self-preservation: output0 category == master category, output0 script == this input's
  a.op(Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY, Op.OP_0, Op.OP_OUTPUTTOKENCATEGORY, Op.OP_EQUALVERIFY);
  a.op(Op.OP_INPUTINDEX, Op.OP_UTXOBYTECODE, Op.OP_0, Op.OP_OUTPUTBYTECODE, Op.OP_EQUALVERIFY);
  // masterBase -> altstack
  a.op(Op.OP_0, Op.OP_UTXOTOKENCATEGORY).push(new Uint8Array([32])).op(Op.OP_SPLIT, Op.OP_DROP, Op.OP_TOALTSTACK); // [k]
  // predecessor (input1) authentic: base == masterBase, capability mutable (0x01)
  a.op(Op.OP_1, Op.OP_UTXOTOKENCATEGORY).push(new Uint8Array([32])).op(Op.OP_SPLIT);       // [k, predBase, predCap]
  a.op(Op.OP_1, Op.OP_EQUALVERIFY);                                     // [k, predBase]
  a.op(Op.OP_FROMALTSTACK, Op.OP_DUP, Op.OP_TOALTSTACK, Op.OP_EQUALVERIFY);                 // [k] (predBase==masterBase)
  // read predecessor commitment -> Ps32, S32
  a.op(Op.OP_1, Op.OP_UTXOTOKENCOMMITMENT).push(new Uint8Array([32])).op(Op.OP_SPLIT);      // [k, Ps32, S32]
  // bracket Ps < k < S
  a.op(Op.OP_OVER, Op.OP_BIN2NUM, Op.OP_3, Op.OP_PICK, Op.OP_BIN2NUM, Op.OP_LESSTHAN, Op.OP_VERIFY);
  a.op(Op.OP_DUP, Op.OP_BIN2NUM, Op.OP_DUP, Op.OP_0, Op.OP_NUMEQUAL);
  a.op(Op.OP_IF, Op.OP_DROP);
  a.op(Op.OP_ELSE, Op.OP_3, Op.OP_PICK, Op.OP_BIN2NUM, Op.OP_SWAP, Op.OP_LESSTHAN, Op.OP_VERIFY, Op.OP_ENDIF); // [k,Ps,S]
  // helper: verify an entry output at index `idx`: bytecode==ENTRY_P2SH, cat base==masterBase + mutable
  const entryOutChecks = (idx: number): void => {
    a.op(idx, Op.OP_OUTPUTBYTECODE).push(ENTRY_P2SH).op(Op.OP_EQUALVERIFY);
    a.op(idx, Op.OP_OUTPUTTOKENCATEGORY).push(new Uint8Array([32])).op(Op.OP_SPLIT).op(Op.OP_1, Op.OP_EQUALVERIFY);
    a.op(Op.OP_FROMALTSTACK, Op.OP_DUP, Op.OP_TOALTSTACK, Op.OP_EQUALVERIFY); // outBase == masterBase
  };
  // output1 P' == Ps||k, at entry addr
  entryOutChecks(Op.OP_1);
  a.op(Op.OP_OVER, Op.OP_3, Op.OP_PICK, Op.OP_CAT, Op.OP_1, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY); // Ps||k
  // output2 NEW == k||S, at entry addr
  entryOutChecks(Op.OP_2);
  a.op(Op.OP_2, Op.OP_PICK, Op.OP_1, Op.OP_PICK, Op.OP_CAT, Op.OP_2, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY); // k||S
  a.op(Op.OP_2DROP, Op.OP_DROP);
  a.op(Op.OP_FROMALTSTACK, Op.OP_DROP, Op.OP_1); // clear altstack (masterBase), succeed
  return a.bytes();
}

const CONTRACT_REDEEM = contractCovenant();
const CONTRACT_P2SH = new Uint8Array([Op.OP_HASH256, 32, ...hash256(CONTRACT_REDEEM), Op.OP_EQUAL]);

function pushRedeem(r: Uint8Array): Uint8Array { return r.length <= 75 ? new Uint8Array([r.length, ...r]) : new Uint8Array([0x4c, r.length, ...r]); }
function push32(d: Uint8Array): Uint8Array { return new Uint8Array([32, ...d]); }
function pushNum(n: number): Uint8Array { return n === 0 ? new Uint8Array([Op.OP_0]) : (n <= 16 ? new Uint8Array([0x50 + n]) : new Uint8Array([1, n])); }

function entryUtxo(txid: string, commitment: Uint8Array): Utxo {
  return { txid, vout: 0, satoshis: 1500n, token: { category: '11'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: binToHex(commitment) } } };
}
const masterCat = { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array([]) } };
const entryTok = (c: Uint8Array): any => ({ category: CATEGORY, amount: 0n, nft: { capability: 'mutable' as const, commitment: c } });

// Assemble + VM-verify (all inputs) a claim(k) transaction from a SortedList plan.
function runClaim(list: SortedList, k: number): true | string {
  const slot = slotValueToBytes(BigInt(k));
  const plan = list.planInsert(slot);
  const tx = {
    version: 2,
    inputs: [
      // input0: master (contract covenant), unlock pushes k32
      { outpointTransactionHash: hexToBin('cc'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([...push32(slot), ...pushRedeem(CONTRACT_REDEEM)]), sequenceNumber: 0xffffffff },
      // input1: predecessor entry (real entry covenant, write path: <masterInputIndex=0> <flag=1>)
      { outpointTransactionHash: hexToBin(plan.predecessor.utxo.txid), outpointIndex: 0, unlockingBytecode: new Uint8Array([...pushNum(0), ...pushNum(1), ...pushRedeem(ENTRY_REDEEM)]), sequenceNumber: 0xffffffff },
      // input2: funder (anyone-can-spend)
      { outpointTransactionHash: hexToBin('fd'.repeat(32)), outpointIndex: 0, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
    ],
    outputs: [
      { lockingBytecode: CONTRACT_P2SH, valueSatoshis: 5000n, token: masterCat },      // master' preserved
      { lockingBytecode: ENTRY_P2SH, valueSatoshis: 1500n, token: entryTok(plan.predNewCommitment) }, // P'
      { lockingBytecode: ENTRY_P2SH, valueSatoshis: 1500n, token: entryTok(plan.newNodeCommitment) }, // NEW
      { lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 900n },              // change
    ],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: CONTRACT_P2SH, valueSatoshis: 5000n, token: masterCat },
    { lockingBytecode: ENTRY_P2SH, valueSatoshis: 1500n, token: entryTok(hexToBin(plan.predecessor.utxo.token!.nft!.commitment)) },
    { lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: 2500n },
  ];
  return createVirtualMachineBch2026().verify({ inputIndex: 0, sourceOutputs, transaction: tx } as any);
}

describe('sorted mapping full-transaction composition (contract + real entry covenant)', () => {
  it('a claim(k) insert is accepted with every input running its real covenant', () => {
    // list: HEAD[0|50] -> A[50|0]. Claim 30 (gap 0..50): pred HEAD, P'=HEAD[0|30], NEW=[30|50].
    const s = (n: number): Uint8Array => slotValueToBytes(BigInt(n));
    const list = SortedList.fromUtxos([
      entryUtxo('00'.repeat(32), encodeEntryCommitment(s(0), s(50))),
      entryUtxo('50'.repeat(32), encodeEntryCommitment(s(50), s(0))),
    ]);
    expect(runClaim(list, 30)).toBe(true);
  });

  it('a claim of a PRESENT key is rejected by the composed covenants', () => {
    const s = (n: number): Uint8Array => slotValueToBytes(BigInt(n));
    const list = SortedList.fromUtxos([
      entryUtxo('00'.repeat(32), encodeEntryCommitment(s(0), s(50))),
      entryUtxo('50'.repeat(32), encodeEntryCommitment(s(50), s(0))),
    ]);
    // planInsert refuses a present key off-chain; force the on-chain path by pointing at HEAD to "re-add" 50.
    const forced = (): true | string => {
      const bad = SortedList.fromUtxos([entryUtxo('00'.repeat(32), encodeEntryCommitment(s(0), s(50)))]); // only HEAD[0|50]
      return runClaim(bad, 50); // HEAD.next == 50 -> bracket 0<50<50 fails
    };
    expect(list.has(s(50))).toBe(true);
    expect(forced()).not.toBe(true);
  });
});

// Live round-trip through the MockNetworkProvider: genesis the list on chain, then have the SDK fetch it, plan a
// claim, submit the real transaction, and observe the persisted new entry NFT. Proves the SortedList <-> provider
// loop, not just an in-memory tx object.
describe('sorted mapping live provider round-trip (SortedList drives a real send)', () => {
  const CONTRACT_HEX = binToHex(CONTRACT_P2SH);
  const ENTRY_HEX = binToHex(ENTRY_P2SH);
  const FUND_HEX = binToHex(new Uint8Array([Op.OP_1]));
  const s = (n: number): Uint8Array => slotValueToBytes(BigInt(n));

  async function claim(provider: MockNetworkProvider, k: number): Promise<string> {
    const entryUtxos = await provider.getUtxosForLockingBytecode(ENTRY_P2SH);
    const list = SortedList.fromUtxos(entryUtxos);
    const plan = list.planInsert(s(k));
    const master = (await provider.getUtxosForLockingBytecode(CONTRACT_P2SH))[0];
    const funder = (await provider.getUtxosForLockingBytecode(new Uint8Array([Op.OP_1])))[0];
    const tx = {
      version: 2,
      inputs: [
        { outpointTransactionHash: hexToBin(master.txid), outpointIndex: master.vout, unlockingBytecode: new Uint8Array([...push32(s(k)), ...pushRedeem(CONTRACT_REDEEM)]), sequenceNumber: 0xffffffff },
        { outpointTransactionHash: hexToBin(plan.predecessor.utxo.txid), outpointIndex: plan.predecessor.utxo.vout, unlockingBytecode: new Uint8Array([...pushNum(0), ...pushNum(1), ...pushRedeem(ENTRY_REDEEM)]), sequenceNumber: 0xffffffff },
        { outpointTransactionHash: hexToBin(funder.txid), outpointIndex: funder.vout, unlockingBytecode: new Uint8Array([]), sequenceNumber: 0xffffffff },
      ],
      outputs: [
        { lockingBytecode: CONTRACT_P2SH, valueSatoshis: master.satoshis, token: masterCat },
        { lockingBytecode: ENTRY_P2SH, valueSatoshis: 1500n, token: entryTok(plan.predNewCommitment) },
        { lockingBytecode: ENTRY_P2SH, valueSatoshis: 1500n, token: entryTok(plan.newNodeCommitment) },
        { lockingBytecode: new Uint8Array([Op.OP_1]), valueSatoshis: funder.satoshis - 3100n },
      ],
      locktime: 0,
    };
    return provider.sendRawTransaction(binToHex(encodeTransaction(tx as any)));
  }

  it('genesis -> claim(30) -> claim(70): entries persist and re-claim is refused', async () => {
    const provider = new MockNetworkProvider();
    await provider.addUtxo(CONTRACT_HEX, { txid: 'c0'.repeat(32), vout: 0, satoshis: 5000n, token: { category: '11'.repeat(32), amount: 0n, nft: { capability: 'minting', commitment: '' } } });
    await provider.addUtxo(ENTRY_HEX, { txid: 'e0'.repeat(32), vout: 0, satoshis: 1500n, token: { category: '11'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(s(0), s(0))) } } });
    await provider.addUtxo(FUND_HEX, { txid: 'f0'.repeat(32), vout: 0, satoshis: 100000n });

    // claim(30): HEAD[0|0] -> HEAD[0|30] + NEW[30|0]
    await claim(provider, 30);
    let entries = SortedList.fromUtxos(await provider.getUtxosForLockingBytecode(ENTRY_P2SH));
    expect(entries.all.map((e) => Number(bytesToSlotValue(e.slot))).sort((a, b) => a - b)).toEqual([0, 30]);
    expect(Number(bytesToSlotValue(entries.find(s(30))!.nextKey))).toBe(0); // tail

    // The provider now needs a fresh funder + the new master outpoint (produced by the claim tx).
    // claim(70): 30[30|0] -> 30[30|70] + NEW[70|0]
    await claim(provider, 70);
    entries = SortedList.fromUtxos(await provider.getUtxosForLockingBytecode(ENTRY_P2SH));
    expect(entries.all.map((e) => Number(bytesToSlotValue(e.slot))).sort((a, b) => a - b)).toEqual([0, 30, 70]);

    // Re-claim 30: present -> the SDK refuses to plan it (and the covenant would reject it on-chain).
    const now = SortedList.fromUtxos(await provider.getUtxosForLockingBytecode(ENTRY_P2SH));
    expect(() => now.planInsert(s(30))).toThrow();
  });
});
