import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import {
  requireSatisfiableReachWrites, type HopCallee, type HopEntryWrites,
} from '../../../src/per-call/proxy/external-calls.js';

/**
 * The cross-reach check one hop runs over the frames it placed, read on its own.
 *
 * Every reach of a mapping-writing callee runs a master of its own and is planned on its own, so the reaches are
 * checked together before any frame is settled. What the check reads of a frame is its own name, the category its
 * records sit at and the writes its plan stated, so a frame is stated here as exactly that much.
 *
 * A value the collection holds decides whether two reaches that write one key can share one transaction: a
 * fixed-width value's node is recreated by each reach's own batch, while a dynamic value's frames write versions
 * of one value and chain through the node.
 */

const IMPL_CATEGORY = 'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f809';
const OTHER_CATEGORY = '0f1e2d3c4b5a69788796a5b4c3d2e1f00112233445566778899aabbccddeeff0';

/** One key's masked slot, and the slot of the node an insert splices through. */
const KEY_SLOT = hexToBin('1122334455667788990011223344556677889900aabbccddeeff00112233c4a1');
const PREDECESSOR_SLOT = hexToBin('55667788990011223344556677889900aabbccddeeff0011223344556677c4b2');
const OTHER_KEY_SLOT = hexToBin('990011223344556677889900aabbccddeeff0011223344556677889900c4c3');

/** A reach's writes, as `hopEntryWrites` states them for one collection. */
function write(options: {
  readonly collection: string;
  readonly chunkable: boolean;
  readonly slots: readonly Uint8Array[];
  readonly spentIds: readonly string[];
}): HopEntryWrites {
  return {
    reachWrites: [{
      collection: options.collection,
      chunkable: options.chunkable,
      targets: options.slots.map((slot) => ({ collection: options.collection, slot })),
      spentIds: options.spentIds,
    }],
  } as unknown as HopEntryWrites;
}

/** A placed callee frame, stated as the check reads it. */
function frame(options: {
  readonly name: string;
  readonly categoryHex: string;
  readonly writes: HopEntryWrites;
}): HopCallee {
  return {
    master: `callee-${options.name}`,
    functionName: options.name,
    category: hexToBin(options.categoryHex),
    entryWrites: options.writes,
  } as unknown as HopCallee;
}

describe('the cross-reach write check', () => {
  it('refuses two reaches that write one key of a fixed-width value', () => {
    const writes = (): HopEntryWrites => write({
      collection: '_held', chunkable: false, slots: [KEY_SLOT], spentIds: [],
    });
    expect(() => requireSatisfiableReachWrites([
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes() }),
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes() }),
    ])).toThrow(/write collection "_held" at the same key/);
  });

  it('allows two reaches that write one key of a dynamic value', () => {
    const writes = (): HopEntryWrites => write({
      collection: '_events', chunkable: true, slots: [KEY_SLOT], spentIds: [],
    });
    expect(() => requireSatisfiableReachWrites([
      frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: writes() }),
      frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: writes() }),
    ])).not.toThrow();
  });

  it('refuses two reaches that insert through one node', () => {
    // Two keys that land in one gap: each reach relinks the one predecessor to its own key.
    const writes = (slot: Uint8Array): HopEntryWrites => write({
      collection: '_held', chunkable: false, slots: [slot], spentIds: ['mapping-node-head'],
    });
    expect(() => requireSatisfiableReachWrites([
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes(KEY_SLOT) }),
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes(OTHER_KEY_SLOT) }),
    ])).toThrow(/insert into collection "_held" through the same node/);
  });

  it('allows reaches of two contracts, and reaches that write different keys', () => {
    const writes = (collection: string, slot: Uint8Array): HopEntryWrites => write({
      collection, chunkable: false, slots: [slot], spentIds: [],
    });
    expect(() => requireSatisfiableReachWrites([
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes('_held', KEY_SLOT) }),
      frame({ name: 'Ledger.move()', categoryHex: OTHER_CATEGORY, writes: writes('_held', KEY_SLOT) }),
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes('_held', OTHER_KEY_SLOT) }),
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes('_seat', KEY_SLOT) }),
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: write({
        collection: '_held', chunkable: false, slots: [PREDECESSOR_SLOT], spentIds: ['mapping-node-other'],
      }) }),
    ])).not.toThrow();
  });
});
