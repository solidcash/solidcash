/**
 * Claim 2: absence is proven by the STRICT predecessor on the MASKED slot, and slot 0 stays reserved for HEAD.
 *
 * Spec: docs/per-call/SPEC_PER_CALL_TRANSACTION.md
 *   1489 - "its strict predecessor as an absence proof (`slot < s(k) < next`, or `next = 0`)";
 *   1491-1492 - "`s(k)` is the key's masked slot ..., never the raw hash: the mask changes the last byte for about
 *          half of all keys. Slots compare as little-endian 255-bit numbers, which the mask keeps non-negative."
 *   1460, 1516-1517 - "Slot 0 is reserved for HEAD: a key whose masked slot is 0 ... is refused as reserved".
 * Doc: packages/solidc/docs/verified-mappings.md 2.1 (slot derivation), 4 (read algorithm), 8 (list validation).
 */
import { describe, it, expect } from 'vitest';
import { sha256, utf8ToBin } from '@bitauth/libauth';
import { SortedList, keyToSlot, headSentinelCommitment } from '../../../../solidcash/src/stateful/SortedList.js';
import { ZERO_SLOT, entryCommitment, entryUtxo, headUtxo, maskedSha256, slotBytes, valueOf } from './fixtures.js';

const KEYS = Array.from({ length: 64 }, (_, i) => utf8ToBin(`holder-${i}`));

describe('section 20 absence proof', () => {
  it('s(k) is the masked sha256 of the key, never the raw hash (SPEC:1475,1491)', () => {
    let sawMaskedKey = false;
    for (const key of KEYS) {
      const raw = sha256.hash(key);
      const masked = maskedSha256(key); // independent: mask the high bit of the last byte
      expect(keyToSlot(key)).toEqual(masked);
      expect(keyToSlot(key)[31]).toBe(raw[31] & 0x7f);
      if ((raw[31] & 0x80) !== 0) {
        sawMaskedKey = true;
        expect(keyToSlot(key)).not.toEqual(raw); // the mask changed this key's last byte
      }
    }
    // The spec claims the mask changes the last byte for about half of all keys; at least one exists here.
    expect(sawMaskedKey).toBe(true);
  });

  it('slot ordering is the masked 255-bit order, not the raw hash order (SPEC:1491-1492)', () => {
    // Find a key pair whose raw-bytes order and masked order disagree (one raw hash has the high bit set).
    let pair: { a: Uint8Array; b: Uint8Array } | undefined;
    for (const a of KEYS) {
      for (const b of KEYS) {
        const rawA = valueOf(sha256.hash(a)); const rawB = valueOf(sha256.hash(b));
        const mA = valueOf(maskedSha256(a)); const mB = valueOf(maskedSha256(b));
        if ((rawA < rawB) !== (mA < mB)) { pair = { a, b }; break; }
      }
      if (pair) break;
    }
    expect(pair).toBeDefined();
    const { a, b } = pair!;
    expect(valueOf(keyToSlot(a)) < valueOf(keyToSlot(b))).toBe(valueOf(maskedSha256(a)) < valueOf(maskedSha256(b)));
    expect(valueOf(keyToSlot(a)) < valueOf(keyToSlot(b))).not.toBe(
      valueOf(sha256.hash(a)) < valueOf(sha256.hash(b)),
    );
    // The mask keeps every slot a positive 255-bit number, so OP_BIN2NUM/OP_LESSTHAN order it as unsigned.
    for (const key of [a, b]) expect(valueOf(keyToSlot(key)) < (1n << 255n)).toBe(true);
  });

  it('the strict predecessor brackets an absent key and is unique; a present key cannot be bracketed', () => {
    const presentKeys = KEYS.slice(0, 32);
    const absentKeys = KEYS.slice(32);
    const sorted = presentKeys.map((key) => keyToSlot(key)).sort((a, b) => (valueOf(a) < valueOf(b) ? -1 : 1));
    const list = SortedList.fromUtxos([
      headUtxo('ff'.repeat(32), sorted[0]),
      ...sorted.map((slot, i) => entryUtxo(
        (i + 1).toString(16).padStart(64, '0'), entryCommitment(slot, sorted[i + 1] ?? ZERO_SLOT),
      )),
    ]);

    // Independent bracket scan over the same link graph, HEAD included (never asking the planner which node
    // brackets what).
    const links = [
      { slot: 0n, next: valueOf(sorted[0]) },
      ...sorted.map((slot, i) => ({ slot: valueOf(slot), next: sorted[i + 1] ? valueOf(sorted[i + 1]) : 0n })),
    ];
    const bracketing = (target: bigint): number => links.filter((link) => (
      link.slot < target && (link.next === 0n || target < link.next)
    )).length;

    for (const key of absentKeys) {
      const target = valueOf(keyToSlot(key));
      const predecessor = list.predecessorOf(keyToSlot(key));
      // Strict inequality `slot < s(k)`, and `next = 0 || s(k) < next`.
      expect(valueOf(predecessor.slot)).toBeLessThan(target);
      const next = valueOf(predecessor.nextKey);
      expect(next === 0n || target < next).toBe(true);
      // Exactly one record brackets the key: the strict predecessor is unique.
      expect(bracketing(target)).toBe(1);
      // And it is the greatest slot below the target.
      const below = sorted.filter((slot) => valueOf(slot) < target);
      expect(valueOf(predecessor.slot)).toBe(below.reduce((max, slot) => (
        valueOf(slot) > max ? valueOf(slot) : max
      ), 0n));
    }

    // For a key that is present, no entry brackets its slot, so omitting the node cannot manufacture an absence
    // proof (verified-mappings.md 4, SPEC:1516-1517).
    for (const key of presentKeys) {
      const target = valueOf(keyToSlot(key));
      expect(bracketing(target)).toBe(0);
      expect(valueOf(list.predecessorOf(keyToSlot(key)).nextKey)).toBe(target);
      expect(() => list.planNonMembership(keyToSlot(key))).toThrow();
      expect(list.planMembership(keyToSlot(key)).entry.slot).toEqual(keyToSlot(key));
    }
  });

  it('an absence plan carries the predecessor read-only (viewIn == viewOut, SPEC:1489)', () => {
    const slot = keyToSlot(utf8ToBin('absent-key'));
    const sortedSlots = KEYS.map((key) => keyToSlot(key)).sort((a, b) => (valueOf(a) < valueOf(b) ? -1 : 1));
    const list = SortedList.fromUtxos([
      headUtxo('ff'.repeat(32), sortedSlots[0]),
      ...sortedSlots.map((s, i) => entryUtxo(
        (i + 1).toString(16).padStart(64, '0'), entryCommitment(s, sortedSlots[i + 1] ?? ZERO_SLOT),
      )),
    ]);

    const plan = list.planNonMembership(slot);
    expect(plan.kind).toBe('nonMembership');
    expect(valueOf(plan.predecessor.slot)).toBeLessThan(valueOf(slot));
    // The plan exposes the predecessor's own UTXO and no replacement commitment: the record is not rewritten.
    expect(plan.predecessor.utxo.token?.nft?.commitment).toBeDefined();
    expect('newCommitment' in plan).toBe(false);
    expect('outputs' in plan).toBe(false);
  });

  it('slot 0 is reserved for HEAD and a reserved-slot access is refused', () => {
    const list = SortedList.fromUtxos([headUtxo()]);
    expect(headSentinelCommitment()).toEqual(new Uint8Array(128));

    // A zero slot resolves to HEAD; HEAD is not a key, so the request is refused rather than inserted.
    expect(() => list.planInsert(ZERO_SLOT)).toThrow(/present/);
    expect(() => list.planBatchUpsert([{ slot: ZERO_SLOT, value: new Uint8Array([1]) }])).toThrow(/reserved/);
    expect(() => list.planJournaledUpserts(
      [{ slot: ZERO_SLOT, operation: new Uint8Array([1]) }], (_current, value) => value,
    )).toThrow(/reserved/);
    // Deletion of HEAD is refused too: no slot lies strictly below 0 (verified-mappings.md 8).
    expect(() => list.planDelete(ZERO_SLOT)).toThrow(/HEAD/);
    expect(() => list.predecessorOf(ZERO_SLOT)).toThrow(/HEAD/);
  });

  it('HEAD is the low bound of the first gap', () => {
    const first = keyToSlot(utf8ToBin('holder-0'));
    const second = keyToSlot(utf8ToBin('holder-1'));
    const low = valueOf(first) < valueOf(second) ? first : second;
    const list = SortedList.fromUtxos([
      headUtxo('ff'.repeat(32), low),
      entryUtxo('aa'.repeat(32), entryCommitment(low, ZERO_SLOT)),
    ]);
    const plan = list.planNonMembership(slotBytes(1n)); // 0 < 1 < low, so the only bracket is HEAD
    expect(plan.predecessor.slot).toEqual(ZERO_SLOT);
    expect(valueOf(plan.predecessor.nextKey)).toBe(valueOf(low));
  });
});
