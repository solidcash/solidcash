import { sha256, hexToBin, binToHex } from '@bitauth/libauth';
import { Utxo } from '../interfaces.js';

// Off-chain manager for a vmap-sound sorted linked-list mapping (see docs/verified-mappings.md). Entries are entry
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

/**
 * slot = sha256(key) with the high bit of the most-significant (last, little-endian) byte cleared. The mask makes
 * it a positive 255-bit script number so OP_BIN2NUM + OP_LESSTHAN order slots as unsigned. The covenant computes
 * the identical slot in-script: OP_SHA256(key), split off the last byte, AND it with 0x7f, re-concatenate. Storing
 * the raw sha256 bytes (masked) - not a re-encoded bigint - is what lets the covenant's byte-wise slot==H(key)
 * membership check match.
 */
export function keyToSlot(key: Uint8Array): Uint8Array {
  const s = sha256.hash(key).slice();
  s[SLOT_BYTES - 1] &= 0x7f;
  return s;
}

/**
 * Composite slot for a nested mapping `m[k0][k1]...`: sha256(sha256(k0) ++ sha256(k1) ++ ...) high-bit-masked. Each
 * key is hashed independently to 32 bytes (so the concatenation is unambiguous for any key type), matching the
 * covenant's emitSortedKeyHash. A single key reduces to keyToSlot(k0).
 */
export function keyToSlotMulti(keys: Uint8Array[]): Uint8Array {
  if (keys.length === 1) return keyToSlot(keys[0]);
  const perKey = keys.map((k) => sha256.hash(k));
  const total = perKey.reduce((n, h) => n + h.length, 0);
  const concat = new Uint8Array(total);
  let off = 0;
  for (const h of perKey) { concat.set(h, off); off += h.length; }
  const s = sha256.hash(concat).slice();
  s[SLOT_BYTES - 1] &= 0x7f;
  return s;
}

export function keyToSlotValue(key: Uint8Array): bigint {
  return bytesToSlotValue(keyToSlot(key));
}

export function encodeEntryCommitment(
  slot: Uint8Array, nextKey: Uint8Array, value: Uint8Array = new Uint8Array(),
): Uint8Array {
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
/** Plan for updating a present key's value: co-spend its entry, rewrite value only (link slot||nextKey preserved). */
export interface UpdatePlan { kind: 'update'; slot: Uint8Array; entry: SortedEntry; newCommitment: Uint8Array }

/** Atomic plan for distinct-key upserts against one original authenticated list. */
export interface BatchUpsertPlan {
  /** Unique original nodes that must be co-spent (existing targets and absent targets' predecessors). */
  inputs: SortedEntry[];
  /** Final recreated/new affected nodes, sorted by slot and emitted exactly once. */
  outputs: Array<{ slot: Uint8Array; commitment: Uint8Array; existed: boolean }>;
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

  planUpdate(slot: Uint8Array, newValue: Uint8Array): UpdatePlan {
    const entry = this.find(slot);
    if (entry === undefined) throw new Error('key is absent; use insert, not update');
    // Link (slot, nextKey) preserved; only the value tail changes.
    return { kind: 'update', slot, entry, newCommitment: encodeEntryCommitment(entry.slot, entry.nextKey, newValue) };
  }

  /**
   * Plan simultaneous distinct-key upserts. All predecessor decisions are made against the ORIGINAL list, then
   * links are rebuilt over the final union. This is the off-chain mirror for the fixed straight-line vmap batch
   * covenant: shared predecessors are consumed once, same-gap inserts become one ascending chain, and an updated
   * existing predecessor carries both its new value and its new first-successor link in one output.
   */
  planBatchUpsert(writes: Array<{ slot: Uint8Array; value: Uint8Array }>): BatchUpsertPlan {
    const bySlot = new Map<string, { slot: Uint8Array; value: Uint8Array }>();
    for (const w of writes) {
      const n = bytesToSlotValue(w.slot);
      if (n === 0n) throw new Error('slot 0 is reserved for the sorted-list HEAD sentinel');
      const key = n.toString();
      if (bySlot.has(key)) throw new Error('vmap batch upsert contains a duplicate slot');
      bySlot.set(key, w);
    }
    if (bySlot.size === 0) return { inputs: [], outputs: [] };

    const inputMap = new Map<string, SortedEntry>();
    const affected = new Set<string>();
    for (const w of bySlot.values()) {
      const present = this.find(w.slot);
      const source = present ?? this.predecessorOf(w.slot);
      const sourceKey = bytesToSlotValue(source.slot).toString();
      inputMap.set(`${source.utxo.txid}:${source.utxo.vout}`, source);
      affected.add(sourceKey);
      affected.add(bytesToSlotValue(w.slot).toString());
    }

    const finalSlots = new Map<string, { slot: Uint8Array; value: Uint8Array; existed: boolean }>();
    for (const e of this.entries) {
      const key = bytesToSlotValue(e.slot).toString();
      finalSlots.set(key, { slot: e.slot, value: bySlot.get(key)?.value ?? e.value, existed: true });
    }
    for (const [key, w] of bySlot) {
      if (!finalSlots.has(key)) finalSlots.set(key, { slot: w.slot, value: w.value, existed: false });
    }
    const ordered = [...finalSlots.values()].sort((a, b) => {
      const av = bytesToSlotValue(a.slot); const bv = bytesToSlotValue(b.slot);
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
    const outputs: BatchUpsertPlan['outputs'] = [];
    for (let i = 0; i < ordered.length; i++) {
      const cur = ordered[i];
      const key = bytesToSlotValue(cur.slot).toString();
      if (!affected.has(key)) continue;
      const next = i + 1 < ordered.length ? ordered[i + 1].slot : ZERO_SLOT;
      outputs.push({ slot: cur.slot, commitment: encodeEntryCommitment(cur.slot, next, cur.value), existed: cur.existed });
    }
    const inputs = [...inputMap.values()].sort((a, b) => {
      const av = bytesToSlotValue(a.slot); const bv = bytesToSlotValue(b.slot);
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
    return { inputs, outputs };
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
