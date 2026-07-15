import { sha256, hexToBin, binToHex } from '@bitauth/libauth';
import { Utxo } from '../interfaces.js';

// Off-chain manager for a C2-sound sorted linked-list mapping (see docs/sorted-mapping-c2.md). Entries are entry
// NFTs whose commitment is slot(32) ++ nextKey(32) [++ value]; they form a sorted singly-linked list. This class
// rebuilds the list from the on-chain entry UTXOs and produces the co-spend PLANS the transaction builder needs:
// non-membership (bracketing predecessor), membership (the entry), insert/delete (predecessor +/- node splices).
// The covenant that consumes these plans is VM-proven in test/e2e/SortedMapping*.test.ts.

const SLOT_BYTES = 32;

/** A parsed entry: 32-byte little-endian slot + nextKey, optional value tail, and the backing UTXO. */
export interface SortedEntry {
  slot: Uint8Array;      // 32-byte little-endian (the covenant reads it with OP_BIN2NUM)
  nextKey: Uint8Array;   // 32-byte little-endian; all-zero == +infinity (list tail)
  value: Uint8Array;     // remaining commitment bytes (empty for a set / key->bool)
  utxo: Utxo;
}

/** big-endian-hash -> numeric slot value, high bit masked so it is a positive (sign-safe) script number. */
export function keyToSlotValue(key: Uint8Array): bigint {
  const h = sha256.hash(key);
  let v = 0n;
  for (const byte of h) v = (v << 8n) | BigInt(byte); // big-endian
  return v & ((1n << 255n) - 1n);                      // mask bit 255 -> positive 255-bit
}

/** numeric slot -> 32-byte little-endian (the commitment / VM encoding). */
export function slotValueToBytes(v: bigint): Uint8Array {
  const b = new Uint8Array(SLOT_BYTES);
  let x = v;
  for (let i = 0; i < SLOT_BYTES; i++) { b[i] = Number(x & 0xffn); x >>= 8n; }
  return b;
}

/** 32-byte little-endian -> numeric value (matches the covenant's OP_BIN2NUM). */
export function bytesToSlotValue(b: Uint8Array): bigint {
  let v = 0n;
  for (let i = SLOT_BYTES - 1; i >= 0; i--) v = (v << 8n) | BigInt(b[i]);
  return v;
}

/** slot = H(key), masked, as 32-byte little-endian. */
export function keyToSlot(key: Uint8Array): Uint8Array {
  return slotValueToBytes(keyToSlotValue(key));
}

export function encodeEntryCommitment(slot: Uint8Array, nextKey: Uint8Array, value: Uint8Array = new Uint8Array()): Uint8Array {
  const out = new Uint8Array(SLOT_BYTES * 2 + value.length);
  out.set(slot, 0);
  out.set(nextKey, SLOT_BYTES);
  out.set(value, SLOT_BYTES * 2);
  return out;
}

export function decodeEntryCommitment(commitment: Uint8Array): { slot: Uint8Array; nextKey: Uint8Array; value: Uint8Array } {
  return {
    slot: commitment.slice(0, SLOT_BYTES),
    nextKey: commitment.slice(SLOT_BYTES, SLOT_BYTES * 2),
    value: commitment.slice(SLOT_BYTES * 2),
  };
}

const ZERO_SLOT = new Uint8Array(SLOT_BYTES); // slot 0 = HEAD sentinel; nextKey 0 = +infinity

/** Co-spend plan for a non-membership read `require(!m[k])` / absent branch. */
export interface NonMembershipPlan { kind: 'nonMembership'; slot: Uint8Array; predecessor: SortedEntry }
/** Co-spend plan for a present-key read. */
export interface MembershipPlan { kind: 'membership'; slot: Uint8Array; entry: SortedEntry }
/** Splice plan for inserting an absent key: rewrite predecessor's next -> k, mint NEW[k|oldNext]. */
export interface InsertPlan {
  kind: 'insert'; slot: Uint8Array; predecessor: SortedEntry;
  predNewCommitment: Uint8Array; newNodeCommitment: Uint8Array;
}
/** Splice plan for deleting a present key: co-spend predecessor + node, rewrite predecessor's next -> node.next. */
export interface DeletePlan {
  kind: 'delete'; slot: Uint8Array; predecessor: SortedEntry; node: SortedEntry;
  predNewCommitment: Uint8Array;
}

export class SortedList {
  private entries: SortedEntry[]; // sorted ascending by slot value

  constructor(entries: SortedEntry[]) {
    this.entries = [...entries].sort((a, b) => (bytesToSlotValue(a.slot) < bytesToSlotValue(b.slot) ? -1 : 1));
  }

  /** Build from the collection's entry NFT UTXOs (each commitment is slot||nextKey||value). */
  static fromUtxos(utxos: Utxo[]): SortedList {
    const entries: SortedEntry[] = [];
    for (const utxo of utxos) {
      const commitment = utxo.token?.nft?.commitment;
      if (commitment === undefined || commitment.length < SLOT_BYTES * 4) continue; // need at least slot+nextKey (hex)
      const { slot, nextKey, value } = decodeEntryCommitment(hexToBin(commitment));
      entries.push({ slot, nextKey, value, utxo });
    }
    return new SortedList(entries);
  }

  get all(): readonly SortedEntry[] { return this.entries; }

  find(slot: Uint8Array): SortedEntry | undefined {
    const target = bytesToSlotValue(slot);
    return this.entries.find((e) => bytesToSlotValue(e.slot) === target);
  }

  has(slot: Uint8Array): boolean { return this.find(slot) !== undefined; }

  /** The entry with the greatest slot < target (the bracketing predecessor). HEAD (slot 0) bounds the low gap. */
  predecessorOf(slot: Uint8Array): SortedEntry {
    const target = bytesToSlotValue(slot);
    let best: SortedEntry | undefined;
    for (const e of this.entries) {
      const s = bytesToSlotValue(e.slot);
      if (s < target && (best === undefined || s > bytesToSlotValue(best.slot))) best = e;
    }
    if (best === undefined) {
      throw new Error('sorted list is missing its HEAD sentinel (slot 0); initialize the map with HEAD[0|0]');
    }
    return best;
  }

  planNonMembership(slot: Uint8Array): NonMembershipPlan {
    if (this.has(slot)) throw new Error('key is present; non-membership proof does not exist');
    return { kind: 'nonMembership', slot, predecessor: this.predecessorOf(slot) };
  }

  planMembership(slot: Uint8Array): MembershipPlan {
    const entry = this.find(slot);
    if (entry === undefined) throw new Error('key is absent; membership proof does not exist');
    return { kind: 'membership', slot, entry };
  }

  planInsert(slot: Uint8Array, value: Uint8Array = new Uint8Array()): InsertPlan {
    if (this.has(slot)) throw new Error('key is present; use update, not insert');
    const predecessor = this.predecessorOf(slot);
    const oldNext = predecessor.nextKey; // becomes NEW's next
    return {
      kind: 'insert', slot, predecessor,
      predNewCommitment: encodeEntryCommitment(predecessor.slot, slot, predecessor.value), // P' next -> k
      newNodeCommitment: encodeEntryCommitment(slot, oldNext, value),                       // NEW[k|oldNext]
    };
  }

  planDelete(slot: Uint8Array): DeletePlan {
    const node = this.find(slot);
    if (node === undefined) throw new Error('key is absent; nothing to delete');
    const predecessor = this.predecessorOf(slot);
    return {
      kind: 'delete', slot, predecessor, node,
      predNewCommitment: encodeEntryCommitment(predecessor.slot, node.nextKey, predecessor.value), // splice out
    };
  }
}

/** The empty-map genesis entry: HEAD[slot 0 | nextKey 0 (+inf)]. */
export function headSentinelCommitment(): Uint8Array {
  return encodeEntryCommitment(ZERO_SLOT, ZERO_SLOT);
}

export { binToHex };
