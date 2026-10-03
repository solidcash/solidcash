import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import {
  chainedNodeIds, requireSatisfiableReachWrites, requireSettledNodeChains, sharedNodeWritersBefore,
  type HopCallee,
} from '../../../src/per-call/proxy/external-calls.js';
import { sharedNodeId, type HopEntryWrites } from '../../../src/per-call/proxy/entry-writes.js';

/**
 * The cross-reach check one hop runs over the frames it placed, read on its own.
 *
 * Every reach of a mapping-writing callee runs a master of its own and is planned on its own, so the reaches are
 * checked together before any frame is settled. What the check reads of a frame is its own name, the category its
 * records sit at, the nodes it reads and the writes its plan stated, so a frame is stated here as exactly that much.
 *
 * A node several reaches touch is one participant whose views chain in the order the frames run, so reads and
 * updates of a key the list holds share one transaction. An insert does not chain on the master, so its chains are
 * refused by name at planning; a value that chunks is sized from the value the deployment holds, so its node is not
 * chained and a write followed by another touch is refused once the hop has settled.
 */

const IMPL_CATEGORY = 'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f809';
const OTHER_CATEGORY = '0f1e2d3c4b5a69788796a5b4c3d2e1f00112233445566778899aabbccddeeff0';

/** One key's masked slot, and the slot of the node an insert splices through. */
const KEY_SLOT = hexToBin('1122334455667788990011223344556677889900aabbccddeeff00112233c4a1');
const PREDECESSOR_SLOT = hexToBin('55667788990011223344556677889900aabbccddeeff0011223344556677c4b2');
const OTHER_KEY_SLOT = hexToBin('990011223344556677889900aabbccddeeff0011223344556677889900c4c3');

/** The participant a node of the implementation's collection is placed under, whichever reach touches it. */
const nodeOf = (collection: string, slot: Uint8Array): string => sharedNodeId(IMPL_CATEGORY, collection, slot);

/** A reach's writes, as `hopEntryWrites` states them for one collection. */
function write(options: {
  readonly collection: string;
  readonly chunkable: boolean;
  readonly slots: readonly Uint8Array[];
  readonly spentIds: readonly string[];
  /** The node each insert splices through; absent states every target as a key the list holds. */
  readonly predecessor?: Uint8Array;
  /** True when the targets continue a node an earlier reach created rather than starting from the deployment. */
  readonly continued?: boolean;
}): HopEntryWrites {
  return {
    reachWrites: [{
      collection: options.collection,
      chunkable: options.chunkable,
      targets: options.slots.map((slot) => ({
        collection: options.collection, slot,
        ...(options.predecessor === undefined ? {} : { predecessor: options.predecessor }),
        ...(options.continued === true ? { continued: true } : {}),
      })),
      spentIds: options.spentIds,
    }],
  } as unknown as HopEntryWrites;
}

/** A placed callee frame, stated as the check reads it. */
function frame(options: {
  readonly name: string;
  readonly categoryHex: string;
  readonly writes?: HopEntryWrites;
  readonly reads?: readonly { readonly id: string; readonly collection: string }[];
}): HopCallee {
  return {
    master: `callee-${options.name}`,
    functionName: options.name,
    category: hexToBin(options.categoryHex),
    enteredBy: null,
    readNodes: options.reads ?? [],
    ...(options.writes === undefined ? {} : { entryWrites: options.writes }),
  } as unknown as HopCallee;
}

describe('the cross-reach write check', () => {
  it('refuses two reaches that insert one key of a fixed-width value the list does not hold', () => {
    const writes = (): HopEntryWrites => write({
      collection: '_held', chunkable: false, slots: [KEY_SLOT], predecessor: PREDECESSOR_SLOT,
      spentIds: [nodeOf('_held', PREDECESSOR_SLOT)],
    });
    expect(() => requireSatisfiableReachWrites([
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes() }),
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes() }),
    ])).toThrow(/write collection "_held" at the same key, which the list does not hold, so each reach inserts it/);
  });

  it('allows a later reach that rewrites the node an earlier reach inserted', () => {
    // The first reach inserts the key and creates its node; the later reach writes the same key, so it continues
    // that node: no predecessor, and its declaration names the creating reach's output.
    const insert = write({
      collection: '_held', chunkable: false, slots: [KEY_SLOT], predecessor: PREDECESSOR_SLOT,
      spentIds: [nodeOf('_held', PREDECESSOR_SLOT)],
    });
    const rewrite = write({
      collection: '_held', chunkable: false, slots: [KEY_SLOT], spentIds: [], continued: true,
    });
    expect(() => requireSatisfiableReachWrites([
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: insert }),
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: rewrite }),
    ])).not.toThrow();
  });

  it('refuses a later reach that writes the inserted key without continuing the created node', () => {
    // The later reach states the same key as an update of a node it does not name as a continuation, so the plan
    // never chained it onto the node the insert created: fail closed as before.
    const insert = write({
      collection: '_held', chunkable: false, slots: [KEY_SLOT], predecessor: PREDECESSOR_SLOT,
      spentIds: [nodeOf('_held', PREDECESSOR_SLOT)],
    });
    const plainRewrite = write({
      collection: '_held', chunkable: false, slots: [KEY_SLOT], spentIds: [],
    });
    expect(() => requireSatisfiableReachWrites([
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: insert }),
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: plainRewrite }),
    ])).toThrow(/write collection "_held" at the same key/);
  });

  it('allows two reaches that update one key of a fixed-width value, the second settled after the first', () => {
    const writes = (): HopEntryWrites => write({
      collection: '_held', chunkable: false, slots: [KEY_SLOT], spentIds: [nodeOf('_held', KEY_SLOT)],
    });
    const frames = [
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes() }),
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes() }),
    ];
    expect(() => requireSatisfiableReachWrites(frames)).not.toThrow();
    expect(sharedNodeWritersBefore(frames)).toStrictEqual(new Map([[1, [0]]]));
  });

  it('allows a read of a node beside the update of its key, in either order', () => {
    const update = (): HopEntryWrites => write({
      collection: '_held', chunkable: false, slots: [KEY_SLOT], spentIds: [nodeOf('_held', KEY_SLOT)],
    });
    const read = [{ id: nodeOf('_held', KEY_SLOT), collection: '_held' }];
    const readFirst = [
      frame({ name: 'Ledger.held()', categoryHex: IMPL_CATEGORY, reads: read }),
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: update() }),
    ];
    const writeFirst = [readFirst[1]!, readFirst[0]!];
    expect(() => requireSatisfiableReachWrites(readFirst)).not.toThrow();
    expect(() => requireSatisfiableReachWrites(writeFirst)).not.toThrow();
    // Only a frame after a write waits for it: the read before the update depends on no other frame.
    expect(sharedNodeWritersBefore(readFirst)).toStrictEqual(new Map());
    expect(sharedNodeWritersBefore(writeFirst)).toStrictEqual(new Map([[1, [0]]]));
  });

  it('leaves two writes of one node of a value that chunks unchained, refused once the hop has settled', () => {
    const writes = (): HopEntryWrites => write({
      collection: '_events', chunkable: true, slots: [KEY_SLOT], spentIds: [nodeOf('_events', KEY_SLOT)],
    });
    const frames = [
      frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: writes() }),
      frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: writes() }),
    ];
    // Planning lets the hop settle, so a frame that refuses first reports itself; nothing orders or chains the node.
    expect(() => requireSatisfiableReachWrites(frames)).not.toThrow();
    expect(chainedNodeIds(frames)).toStrictEqual(new Set());
    expect(sharedNodeWritersBefore(frames)).toStrictEqual(new Map());
    expect(() => requireSettledNodeChains(frames))
      .toThrow(/that an earlier reach "Store.publish\(\)" writes, and its values chunk/);
  });

  it('refuses two reaches that insert through one node', () => {
    // Two keys that land in one gap: each reach relinks the one predecessor to its own key.
    const writes = (slot: Uint8Array): HopEntryWrites => write({
      collection: '_held', chunkable: false, slots: [slot], predecessor: PREDECESSOR_SLOT,
      spentIds: [nodeOf('_held', PREDECESSOR_SLOT)],
    });
    expect(() => requireSatisfiableReachWrites([
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes(KEY_SLOT) }),
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes(OTHER_KEY_SLOT) }),
    ])).toThrow(/insert into collection "_held" through the same node/);
  });

  it('refuses a read of the node an earlier reach relinks to insert a key', () => {
    const insert = write({
      collection: '_held', chunkable: false, slots: [KEY_SLOT], predecessor: PREDECESSOR_SLOT,
      spentIds: [nodeOf('_held', PREDECESSOR_SLOT)],
    });
    expect(() => requireSatisfiableReachWrites([
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: insert }),
      frame({
        name: 'Ledger.held()', categoryHex: IMPL_CATEGORY,
        reads: [{ id: nodeOf('_held', PREDECESSOR_SLOT), collection: '_held' }],
      }),
    ])).toThrow(/that an earlier reach "Ledger.move\(\)" relinks to insert a key/);
  });

  it('allows a read of the node an earlier reach created, planned as its own node', () => {
    // The reach reads the key the insert added, so it resolves to the node the insert created rather than the
    // bracketing predecessor it relinked: the read is one touch on the created node, and the relink stays alone.
    const insert = write({
      collection: '_held', chunkable: false, slots: [KEY_SLOT], predecessor: PREDECESSOR_SLOT,
      spentIds: [nodeOf('_held', PREDECESSOR_SLOT)],
    });
    expect(() => requireSatisfiableReachWrites([
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: insert }),
      frame({
        name: 'Ledger.held()', categoryHex: IMPL_CATEGORY,
        reads: [{ id: nodeOf('_held', KEY_SLOT), collection: '_held' }],
      }),
    ])).not.toThrow();
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
