import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import {
  chainedNodeIds, requireSatisfiableReachWrites, requireSettledNodeChains, sharedNodeWritersBefore,
  type HopCallee,
} from '../../../src/framed/proxy/external-calls.js';
import { sharedNodeId, type HopEntryWrites } from '../../../src/framed/proxy/entry-writes.js';

/**
 * The cross-reach check one hop runs over the frames it placed, read on its own.
 *
 * Every reach of a mapping-writing callee runs a master of its own and is planned on its own, so the reaches are
 * checked together before any frame is settled. What the check reads of a frame is its own name, the category its
 * records sit at, the nodes it reads and the writes its plan stated, so a frame is stated here as exactly that much.
 *
 * A node several reaches touch is one participant whose views chain in the order the frames run, so reads, updates
 * and the relinks of inserts share one transaction: each reach is planned against the list the reaches before it
 * left. A key the list does not hold is inserted once, so a second insert of it is refused by name. A value that
 * chunks chains the same way, and the later reach continues from the bytes the reach before it wrote; a chunkable
 * write that states no value leaves the later reach none, refused once the hop has settled, and a relink states
 * none, refused at planning.
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

  it('chains two writes of one node of a value that chunks, refused when the earlier states no value', () => {
    const writes = (): HopEntryWrites => write({
      collection: '_events', chunkable: true, slots: [KEY_SLOT], spentIds: [nodeOf('_events', KEY_SLOT)],
    });
    const frames = [
      frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: writes() }),
      frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: writes() }),
    ];
    // A chunking node chains like any other: the later reach is settled after the writer that leaves its view.
    expect(() => requireSatisfiableReachWrites(frames)).not.toThrow();
    expect(chainedNodeIds(frames)).toStrictEqual(new Set([nodeOf('_events', KEY_SLOT)]));
    expect(sharedNodeWritersBefore(frames)).toStrictEqual(new Map([[1, [0]]]));
    // Neither reach states a value the later one continues from, so the run it takes cannot be sized: refuse.
    expect(() => requireSettledNodeChains(frames))
      .toThrow(/that an earlier reach "Store.publish\(\)" writes, and its values chunk/);
  });

  it('refuses a later reach when the reach before it states its chunking write without a value', () => {
    // The write facts carry a value only for a write whose value the plan stated: a placeholder is not the bytes the
    // node holds, so the later reach would size its own run from something the write never produced.
    const stating = (value: Uint8Array | undefined): HopEntryWrites => ({
      ...write({
        collection: '_events', chunkable: true, slots: [KEY_SLOT], spentIds: [nodeOf('_events', KEY_SLOT)],
      }),
      writtenNodes: [{
        collection: '_events', slot: KEY_SLOT, commitment: KEY_SLOT,
        ...(value === undefined ? {} : { value }),
      }],
    } as unknown as HopEntryWrites);
    const frames = (value: Uint8Array | undefined): ReturnType<typeof frame>[] => [
      frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: stating(value) }),
      frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: stating(value) }),
    ];
    expect(() => requireSettledNodeChains(frames(KEY_SLOT))).not.toThrow();
    expect(() => requireSettledNodeChains(frames(undefined)))
      .toThrow(/the reach before it states no value a later reach can continue from/);
  });

  it('checks every write of a chunking node a later reach continues from, not only the first', () => {
    const stating = (value: Uint8Array | undefined): HopEntryWrites => ({
      ...write({
        collection: '_events', chunkable: true, slots: [KEY_SLOT], spentIds: [nodeOf('_events', KEY_SLOT)],
      }),
      writtenNodes: [{
        collection: '_events', slot: KEY_SLOT, commitment: KEY_SLOT,
        ...(value === undefined ? {} : { value }),
      }],
    } as unknown as HopEntryWrites);
    const third = frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: stating(KEY_SLOT) });
    // The first reach states its value and the second does not, so the third has nothing to continue from.
    expect(() => requireSettledNodeChains([
      frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: stating(KEY_SLOT) }),
      frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: stating(undefined) }),
      third,
    ])).toThrow(/the reach before it states no value a later reach can continue from/);
  });

  it('allows two reaches that update one key of a chunking value the earlier states a value for', () => {
    const stating = (): HopEntryWrites => ({
      ...write({
        collection: '_events', chunkable: true, slots: [KEY_SLOT], spentIds: [nodeOf('_events', KEY_SLOT)],
      }),
      writtenNodes: [{ collection: '_events', slot: KEY_SLOT, commitment: KEY_SLOT, value: KEY_SLOT }],
    } as unknown as HopEntryWrites);
    const frames = [
      frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: stating() }),
      frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: stating() }),
    ];
    expect(() => requireSettledNodeChains(frames)).not.toThrow();
  });

  it('allows two reaches that insert into one gap, the later settled after the earlier', () => {
    // Two keys that land in one gap: the later reach is planned against the link the earlier one left, so it relinks
    // the predecessor again from the view the earlier relink left.
    const writes = (slot: Uint8Array): HopEntryWrites => write({
      collection: '_held', chunkable: false, slots: [slot], predecessor: PREDECESSOR_SLOT,
      spentIds: [nodeOf('_held', PREDECESSOR_SLOT)],
    });
    const frames = [
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes(KEY_SLOT) }),
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: writes(OTHER_KEY_SLOT) }),
    ];
    expect(() => requireSatisfiableReachWrites(frames)).not.toThrow();
    expect(sharedNodeWritersBefore(frames)).toStrictEqual(new Map([[1, [0]]]));
  });

  it('allows an insert through a node an earlier reach updated, and an update of a node an earlier reach relinked',
    () => {
      const update = write({
        collection: '_held', chunkable: false, slots: [PREDECESSOR_SLOT],
        spentIds: [nodeOf('_held', PREDECESSOR_SLOT)],
      });
      const insert = write({
        collection: '_held', chunkable: false, slots: [KEY_SLOT], predecessor: PREDECESSOR_SLOT,
        spentIds: [nodeOf('_held', PREDECESSOR_SLOT)],
      });
      const updateFirst = [
        frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: update }),
        frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: insert }),
      ];
      expect(() => requireSatisfiableReachWrites(updateFirst)).not.toThrow();
      expect(() => requireSatisfiableReachWrites([updateFirst[1]!, updateFirst[0]!])).not.toThrow();
      expect(sharedNodeWritersBefore(updateFirst)).toStrictEqual(new Map([[1, [0]]]));
    });

  it('allows an insert through the node an earlier reach created', () => {
    // The created node carries no input, so the later reach names it at the creating reach's output and spends none.
    expect(() => requireSatisfiableReachWrites([
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: write({
        collection: '_held', chunkable: false, slots: [KEY_SLOT], predecessor: PREDECESSOR_SLOT,
        spentIds: [nodeOf('_held', PREDECESSOR_SLOT)],
      }) }),
      frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: write({
        collection: '_held', chunkable: false, slots: [OTHER_KEY_SLOT], predecessor: KEY_SLOT, spentIds: [],
      }) }),
    ])).not.toThrow();
  });

  it('allows a read of the node an earlier reach relinks to insert a key, and refuses it for a value that chunks',
    () => {
      const insertInto = (collection: string, chunkable: boolean): HopEntryWrites => write({
        collection, chunkable, slots: [KEY_SLOT], predecessor: PREDECESSOR_SLOT,
        spentIds: [nodeOf(collection, PREDECESSOR_SLOT)],
      });
      const readOf = (collection: string): HopCallee => frame({
        name: 'Ledger.held()', categoryHex: IMPL_CATEGORY,
        reads: [{ id: nodeOf(collection, PREDECESSOR_SLOT), collection }],
      });
      expect(() => requireSatisfiableReachWrites([
        frame({ name: 'Ledger.move()', categoryHex: IMPL_CATEGORY, writes: insertInto('_held', false) }),
        readOf('_held'),
      ])).not.toThrow();
      // A chunking node's later reach continues from the bytes the write before it stated, and a relink states none.
      expect(() => requireSatisfiableReachWrites([
        frame({ name: 'Store.publish()', categoryHex: IMPL_CATEGORY, writes: insertInto('_events', true) }),
        readOf('_events'),
      ])).toThrow(/that an earlier reach "Store.publish\(\)" relinks to insert a key; a node whose values chunk/);
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
