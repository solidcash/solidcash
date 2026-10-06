/**
 * Shared fixtures for the section-20 record proofs (`docs/framed/SPEC_FRAMED_TRANSACTION.md`).
 *
 * Commitments are assembled here with a plain byte concatenation, never with the codec under test, so a test that
 * compares a shipped encoder against `entryCommitment`/`splitCommitment` compares it against an independent
 * construction. The same independence is why the reachability walk re-derives the link graph from commitment bytes
 * instead of asking the planner under test which nodes it considers linked.
 */
import { sha256 } from '@bitauth/libauth';
import type { Utxo } from '../../../../solidcash/src/interfaces.js';
import { SortedList } from '../../../../solidcash/src/stateful/SortedList.js';

export const CATEGORY = '11'.repeat(31) + 'ee';
export const SLOT_BYTES = 32;
export const ZERO_SLOT = new Uint8Array(SLOT_BYTES);

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

/** 32-byte little-endian slot, assembled without the shipped `slotValueToBytes`. */
export function slotBytes(n: bigint | number): Uint8Array {
  const out = new Uint8Array(SLOT_BYTES);
  let x = BigInt(n);
  for (let i = 0; i < SLOT_BYTES; i += 1) { out[i] = Number(x & 0xffn); x >>= 8n; }
  return out;
}

/** `sha256(key)` with the high bit of the last byte cleared - the spec's `mask` (SPEC:1475-1477). */
export function maskedSha256(key: Uint8Array): Uint8Array {
  const h = sha256.hash(key).slice();
  h[SLOT_BYTES - 1] &= 0x7f;
  return h;
}

/** Node layout `slot(32) || next(32) || value tail` (SPEC:1459), concatenated by hand. */
export function entryCommitment(slot: Uint8Array, next: Uint8Array, value: Uint8Array = new Uint8Array()): Uint8Array {
  return concatBytes(slot, next, value);
}

/** Independent layout split: the commitment's own field offsets (SPEC:1459). */
export function splitCommitment(commitment: Uint8Array): { slot: Uint8Array; next: Uint8Array; value: Uint8Array } {
  return {
    slot: commitment.slice(0, SLOT_BYTES),
    next: commitment.slice(SLOT_BYTES, SLOT_BYTES * 2),
    value: commitment.slice(SLOT_BYTES * 2),
  };
}

export function entryUtxo(txid: string, commitment: Uint8Array, vout = 0): Utxo {
  return {
    txid, vout, satoshis: 1000n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: hex(commitment) } },
  };
}

/** The genesis HEAD record: slot 0, `next` (0 for the empty map), 64-byte empty-value pad (SPEC:1460). */
export function headUtxo(txid = '00'.repeat(31) + 'ff', next: Uint8Array = ZERO_SLOT): Utxo {
  return entryUtxo(txid, concatBytes(new Uint8Array(SLOT_BYTES), next, new Uint8Array(64)));
}

export function listOf(nodes: Array<{ slot: Uint8Array; next: Uint8Array; value?: Uint8Array }>): SortedList {
  return SortedList.fromUtxos(nodes.map((node, i) => entryUtxo(
    i.toString(16).padStart(64, '0'), entryCommitment(node.slot, node.next, node.value ?? new Uint8Array()),
  )));
}

/**
 * Independent reachability walk over `slot -> next` links, starting at HEAD (slot 0). Returns the visited slots in
 * link order. Throws on a missing or duplicated slot, and stops at the 0 terminator so a cycle is not followed.
 */
export function walkReachable(entries: ReadonlyArray<{ slot: Uint8Array; next: Uint8Array }>): bigint[] {
  const links = new Map<bigint, bigint>();
  for (const entry of entries) {
    const slot = valueOf(entry.slot);
    if (links.has(slot)) throw new Error(`duplicate slot ${slot}`);
    links.set(slot, valueOf(entry.next));
  }
  const visited: bigint[] = [];
  let cursor = 0n;
  while (true) {
    visited.push(cursor);
    const next = links.get(cursor);
    if (next === undefined) throw new Error(`unresolved link from slot ${cursor}`);
    if (next === 0n) return visited;
    if (visited.includes(next)) throw new Error(`cycle at slot ${next}`);
    cursor = next;
  }
}

/** Numeric value of a 32-byte little-endian slot, computed here rather than by the shipped helper. */
export function valueOf(slot: Uint8Array): bigint {
  let v = 0n;
  for (let i = slot.length - 1; i >= 0; i -= 1) v = (v << 8n) | BigInt(slot[i]);
  return v;
}

export function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
