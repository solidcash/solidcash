import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import {
  buildPushdataCommitment, encodeChunkableValueTail, encodeIntegerValue, encodePushdataValue, type StateValue,
} from '@solidcash/utils';
import { keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import {
  deployFramedMaster, distinctBytes, evaluateMasterSpend, node, spent, type DeployedMaster, type PlacedRecord,
} from './record-spend.js';

/**
 * A framed body whose mapping access reads another entry inside its own element index or key, settled on the
 * BCH-2026 machine: `logs[id][logs[id].length - 1]` reads the entry it indexes, `logs[id][at[id]]` another
 * mapping's value, `seen[at[id]]` and `grid[id][at[id]]` name a node by a value read from another node, and a write
 * takes its element index or its key from the same reads. Each inner read is an entry access of its own, so the
 * frame declares its record beside the outer one: read-only nodes in the order the block layout lists their slots,
 * the access before the reads in its index and key, and ahead of the groups of the nodes the body writes.
 *
 * Each body stores what it read in the data record, or writes where its index or key names, so the record or the
 * written node carries the read's value: the honest transaction is accepted and the same transaction carrying
 * another element or node is refused. The data record sits at 2 and the nodes follow it from 3; the user signs at 0
 * and the master runs at 1. A read nested in an index after a push of the same entry is in
 * `read-after-push.test.ts`, and its refusal after a push the frame does not keep in `read-after-write-refusal`.
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
const STATE = ' uint public count; bytes4 public lastKind; mapping(uint => bytes4[]) logs; mapping(uint => uint) at;'
  + ' mapping(uint => uint) seen; mapping(uint => mapping(uint => uint)) grid;';

/** Bodies that only read, the inner read in an element index. */
const INDEXED = deployFramedMaster(`${PRAGMA} contract Indexed {${STATE}`
  + ' function takeLast(uint id) { this.lastKind = this.logs[id][this.logs[id].length - 1]; }'
  + ' function takeAt(uint id) { this.lastKind = this.logs[id][this.at[id]]; }'
  + ' }', 'nested entry read indexed');

/** Bodies that only read, the inner read in a key. */
const KEYED = deployFramedMaster(`${PRAGMA} contract Keyed {${STATE}`
  + ' function takeSeen(uint id) { this.count = this.seen[this.at[id]]; }'
  + ' function takeCell(uint id) { this.count = this.grid[id][this.at[id]]; }'
  + ' }', 'nested entry read keyed');

/** Bodies that write the element an inner read indexes. */
const WRITTEN = deployFramedMaster(`${PRAGMA} contract Written {${STATE}`
  + ' function putLast(uint id, bytes4 k) { this.logs[id][this.logs[id].length - 1] = k; }'
  + ' function putAt(uint id, bytes4 k) { this.logs[id][this.at[id]] = k; }'
  + ' }', 'nested entry read written');

/** Bodies that write the node an inner read keys. */
const KEY_WRITTEN = deployFramedMaster(`${PRAGMA} contract KeyWritten {${STATE}`
  + ' function putSeen(uint id, uint v) { this.seen[this.at[id]] = v; }'
  + ' function putPicked(uint id, uint v) { this.seen[(1 == 1) ? this.at[id] : 0] = v; }'
  + ' }', 'nested entry read key written');

const ID = encodeIntegerValue(7n);
const SLOT = keyToSlotMulti([ID]);
const J = encodeIntegerValue(5n);
const OTHER = encodeIntegerValue(6n);
const HELD = distinctBytes(4, 0x15);
const ADDED = distinctBytes(4, 0x3c);
const THIRD = distinctBytes(4, 0x61);
const NO_KIND = new Uint8Array(4);
const DATA_INDEX = 2;

/** The node at `ID` holding `kinds` in `logs`, the end of the list. */
function logsOf(kinds: readonly Uint8Array[]): Uint8Array {
  return node(SLOT, undefined, encodeChunkableValueTail(encodePushdataValue([...kinds], 'bytes4[]')));
}

/** A `uint` node at `slot` holding `value`, the end of the list. */
function uintOf(slot: Uint8Array, value: bigint): Uint8Array {
  return node(slot, undefined, encodeIntegerValue(value));
}

/** The data record for the given fields, in the shipped encoding; every master here shares one state layout. */
function record(count: bigint, lastKind: Uint8Array = NO_KIND): Uint8Array {
  const values: Record<string, StateValue> = { count, lastKind };
  return hexToBin(buildPushdataCommitment(INDEXED.artifact.stateLayout!, values, 0));
}

/** The data record rewritten from `data[0]` to `data[1]`, then each node kept or rewritten, in declaration order. */
function spend(master: DeployedMaster, data: [Uint8Array, Uint8Array],
  nodes: readonly [string, Uint8Array, Uint8Array?][]): PlacedRecord[] {
  return [
    spent(master.recordLock, DATA_INDEX, data[0], data[1]),
    ...nodes.map(([collection, before, after], at) =>
      spent(master.collectionLock(collection), DATA_INDEX + 1 + at, before, after ?? before)),
  ];
}

const accepts = (master: DeployedMaster, entry: string, args: Uint8Array[], records: PlacedRecord[]): boolean =>
  evaluateMasterSpend(master, { entry, args, records }).accepted;

describe('a framed body whose mapping access reads an entry inside its own element index', () => {
  it('publishes every body as a framed master within the input-script limit and with no refused entry', () => {
    for (const master of [INDEXED, KEYED, WRITTEN, KEY_WRITTEN]) {
      expect(master.artifact.composition?.convention).toBe('framed');
      expect((master.artifact.composition as { refusedEntries?: unknown }).refusedEntries).toBeUndefined();
      expect(master.script.length).toBeLessThanOrEqual(10_000);
    }
  });

  it('reads the last element through a length read of the same entry', () => {
    const taken = (kind: Uint8Array): PlacedRecord[] =>
      spend(INDEXED, [record(0n), record(0n, kind)], [['logs', logsOf([HELD, ADDED, THIRD])]]);
    expect(accepts(INDEXED, 'takeLast', [ID], taken(THIRD))).toBe(true);
    expect(accepts(INDEXED, 'takeLast', [ID], taken(ADDED))).toBe(false);
    expect(accepts(INDEXED, 'takeLast', [ID], taken(HELD))).toBe(false);
  });

  it('reads the element another mapping\'s entry names, whose record follows the indexed one', () => {
    const taken = (index: bigint, kind: Uint8Array): PlacedRecord[] => spend(INDEXED, [record(0n), record(0n, kind)],
      [['logs', logsOf([HELD, ADDED, THIRD])], ['at', uintOf(SLOT, index)]]);
    expect(accepts(INDEXED, 'takeAt', [ID], taken(1n, ADDED))).toBe(true);
    expect(accepts(INDEXED, 'takeAt', [ID], taken(1n, HELD))).toBe(false);
    expect(accepts(INDEXED, 'takeAt', [ID], taken(2n, THIRD))).toBe(true);
    expect(accepts(INDEXED, 'takeAt', [ID], taken(2n, ADDED))).toBe(false);
  });
});

describe('a framed body whose mapping key is a value read from another entry', () => {
  it('reads the node the inner read keys, whose record precedes the inner one', () => {
    const taken = (count: bigint, key: Uint8Array = J): PlacedRecord[] => spend(KEYED, [record(0n), record(count)],
      [['seen', uintOf(keyToSlotMulti([key]), 9n)], ['at', uintOf(SLOT, 5n)]]);
    expect(accepts(KEYED, 'takeSeen', [ID], taken(9n))).toBe(true);
    expect(accepts(KEYED, 'takeSeen', [ID], taken(8n))).toBe(false);
    // The node another key names is not the one the inner read keys.
    expect(accepts(KEYED, 'takeSeen', [ID], taken(9n, OTHER))).toBe(false);
  });

  it('reads the nested mapping\'s node whose second key the inner read supplies', () => {
    const taken = (count: bigint, keys: Uint8Array[] = [ID, J]): PlacedRecord[] =>
      spend(KEYED, [record(0n), record(count)], [['grid', uintOf(keyToSlotMulti(keys), 9n)], ['at', uintOf(SLOT, 5n)]]);
    expect(accepts(KEYED, 'takeCell', [ID], taken(9n))).toBe(true);
    expect(accepts(KEYED, 'takeCell', [ID], taken(8n))).toBe(false);
    expect(accepts(KEYED, 'takeCell', [ID], taken(9n, [ID, OTHER]))).toBe(false);
  });
});

describe('a framed write whose element index or key reads an entry', () => {
  const args = [ADDED, ID];

  it('writes the last element a length read of the same entry names', () => {
    const put = (after: readonly Uint8Array[]): PlacedRecord[] =>
      spend(WRITTEN, [record(0n), record(0n)], [['logs', logsOf([HELD, THIRD]), logsOf(after)]]);
    expect(accepts(WRITTEN, 'putLast', args, put([HELD, ADDED]))).toBe(true);
    expect(accepts(WRITTEN, 'putLast', args, put([ADDED, THIRD]))).toBe(false);
  });

  it('writes the element another mapping\'s entry names, whose record precedes the written node\'s group', () => {
    const put = (index: bigint, after: readonly Uint8Array[]): PlacedRecord[] => spend(WRITTEN,
      [record(0n), record(0n)], [['at', uintOf(SLOT, index)], ['logs', logsOf([HELD, THIRD]), logsOf(after)]]);
    expect(accepts(WRITTEN, 'putAt', args, put(0n, [ADDED, THIRD]))).toBe(true);
    expect(accepts(WRITTEN, 'putAt', args, put(0n, [HELD, ADDED]))).toBe(false);
    expect(accepts(WRITTEN, 'putAt', args, put(1n, [HELD, ADDED]))).toBe(true);
  });

  it('writes the node another mapping\'s entry keys, bare or as the taken branch of a ternary', () => {
    const put = (key: Uint8Array, after: bigint): PlacedRecord[] => spend(KEY_WRITTEN, [record(0n), record(0n)],
      [['at', uintOf(SLOT, 5n)], ['seen', uintOf(keyToSlotMulti([key]), 9n), uintOf(keyToSlotMulti([key]), after)]]);
    const write = [encodeIntegerValue(4n), ID];
    for (const entry of ['putSeen', 'putPicked']) {
      expect(accepts(KEY_WRITTEN, entry, write, put(J, 4n))).toBe(true);
      expect(accepts(KEY_WRITTEN, entry, write, put(J, 9n))).toBe(false);
      expect(accepts(KEY_WRITTEN, entry, write, put(OTHER, 4n))).toBe(false);
    }
  });
});
