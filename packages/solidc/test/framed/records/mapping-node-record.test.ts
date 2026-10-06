/**
 * Claim 1: an exact read of a mapping node, and the node commitment layout.
 *
 * Spec: docs/per-call/SPEC_PER_CALL_TRANSACTION.md
 *   1459 - mapping node: `slot(32) || next(32) || value tail`, one entry covenant per collection salted with
 *          `sha256(name:type)[:20]`;
 *   1460 - HEAD sentinel: the same lock, slot 0;
 *   1488-1490 - "A frame reads a node ... as a touched record with `viewIn == viewOut`. Its own code checks the
 *          proof, as today."
 * Doc: packages/solidc/docs/verified-mappings.md 2.2 (node commitment), 3.1 (inline values), 4 (read algorithm).
 */
import { describe, it, expect } from 'vitest';
import { sha256, utf8ToBin } from '@bitauth/libauth';
import {
  SortedList, encodeEntryCommitment, decodeEntryCommitment, keyToSlot, slotValueToBytes, bytesToSlotValue,
  headSentinelCommitment,
} from '../../../../solidcash/src/stateful/SortedList.js';
import {
  computeCollectionHash, computeCollectionSignature, buildEntryNftCovenantBytecode,
} from '../../../../utils/src/state.js';
import { ZERO_SLOT, entryCommitment, entryUtxo, headUtxo, hex, splitCommitment, valueOf } from './fixtures.js';

const TWO_KEYS = [
  { key: utf8ToBin('holder-a'), value: new Uint8Array([0x2a]) },
  { key: utf8ToBin('holder-b'), value: new Uint8Array([0x2b, 0x01]) },
];

describe('section 20 mapping node record', () => {
  it('a node commitment is slot(32) || next(32) || value tail (SPEC:1459)', () => {
    const slot = keyToSlot(TWO_KEYS[0].key);
    const next = keyToSlot(TWO_KEYS[1].key);
    const expected = entryCommitment(slot, next, TWO_KEYS[0].value); // independent concatenation

    expect(encodeEntryCommitment(slot, next, TWO_KEYS[0].value)).toEqual(expected);
    expect(expected.length).toBe(2 * 32 + TWO_KEYS[0].value.length);

    const decoded = decodeEntryCommitment(expected);
    expect(decoded.slot).toEqual(slot);
    expect(decoded.nextKey).toEqual(next);
    expect(decoded.value).toEqual(TWO_KEYS[0].value);
    // The tail is whatever follows the two 32-byte fields; `next == 0` terminates the list.
    expect(splitCommitment(expected).value).toEqual(TWO_KEYS[0].value);
  });

  it('the HEAD sentinel is a slot-0 node with an empty 64-byte tail (SPEC:1460)', () => {
    const head = headSentinelCommitment();
    expect(head).toEqual(new Uint8Array(128)); // all zeros: slot 0 || next 0 || 64-byte empty pad
    expect(head.length).toBe(128);
    const decoded = decodeEntryCommitment(head);
    expect(bytesToSlotValue(decoded.slot)).toBe(0n);
    expect(bytesToSlotValue(decoded.nextKey)).toBe(0n);
    expect(decoded.value.length).toBe(64);
    expect(decoded.value.every((byte) => byte === 0)).toBe(true);
  });

  it('an exact read returns the node whose slot equals the key hash (SPEC:1488-1490)', () => {
    const slotA = keyToSlot(TWO_KEYS[0].key);
    const slotB = keyToSlot(TWO_KEYS[1].key);
    const [first, second] = [slotA, slotB].sort((a, b) => (valueOf(a) < valueOf(b) ? -1 : 1));
    const list = SortedList.fromUtxos([
      headUtxo(),
      entryUtxo('aa'.repeat(31) + '55', entryCommitment(first, second, new Uint8Array([0x09]))),
      entryUtxo('bb'.repeat(31) + '44', entryCommitment(second, ZERO_SLOT, new Uint8Array([0x0a]))),
    ]);

    const plan = list.planMembership(second);
    // The record is read by whole commitment: the plan names the exact entry and mints nothing new
    // (viewIn == viewOut, SPEC:1489).
    expect(plan.kind).toBe('membership');
    expect(plan.entry.slot).toEqual(second);
    expect(plan.entry.value).toEqual(new Uint8Array([0x0a]));
    expect('newCommitment' in plan).toBe(false);

    // A present key has no absence proof, exactly as verified-mappings.md 4 describes.
    expect(() => list.planNonMembership(second)).toThrow();
  });

  it('the entry covenant is one per collection, salted with sha256(name:type)[:20] (SPEC:1459)', () => {
    const signature = computeCollectionSignature('balances', 'mapping(int256 => int256)');
    expect(signature).toBe('balances:mapping(int256 => int256)');

    // Independent salt: SHA-256 of the UTF-8 signature, truncated to 20 bytes.
    expect(computeCollectionHash(signature)).toEqual(sha256.hash(utf8ToBin(signature)).slice(0, 20));

    const category = new Uint8Array(32).map((_, i) => i + 1);
    const categoryHex = hex(category);
    const bytecode = buildEntryNftCovenantBytecode(categoryHex, signature);
    // Deterministic, and distinct per collection and per contract.
    expect(bytecode).toBe(buildEntryNftCovenantBytecode(categoryHex, signature));
    expect(bytecode).not.toBe(buildEntryNftCovenantBytecode(categoryHex, 'balances:mapping(int256 => bool)'));
    expect(bytecode).not.toBe(buildEntryNftCovenantBytecode(hex(new Uint8Array(32).map((_, i) => i + 2)), signature));
    // The lock embeds the collection salt and the reverse-ordered (internal) category it pins.
    expect(bytecode).toContain(hex(computeCollectionHash(signature)));
    expect(bytecode).toContain(hex(category.slice().reverse()));
  });

  it('a node without a HEAD sentinel has no bracketing predecessor and is refused', () => {
    // verified-mappings.md 2.2/4: the list is anchored at HEAD; without it the first gap has no low bound.
    const orphaned = SortedList.fromUtxos([
      entryUtxo('cc'.repeat(31) + '33', entryCommitment(slotValueToBytes(5n), ZERO_SLOT)),
    ]);
    expect(() => orphaned.predecessorOf(slotValueToBytes(1n))).toThrow(/HEAD/);
    expect(() => orphaned.planNonMembership(slotValueToBytes(1n))).toThrow();
  });
});
