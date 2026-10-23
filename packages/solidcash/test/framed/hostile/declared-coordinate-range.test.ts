import { describe, expect, it } from 'vitest';
import { encodeIntegerValue, encodePushdataValue, type RecordEntry } from '@solidcash/utils';
import {
  created, declarationOf, deployFramedMaster, distinctBytes, evaluateMasterSpend, head, node, spent,
  type DeployedMaster, type PlacedRecord,
} from '../../../../solidc/test/framed/master/record-spend.js';
import {
  chunkCommitments, chunkLock, lengthHeader, type ChunkRunContract,
} from '../../../../solidc/test/framed/master/chunk-run-input.js';
import { keyToSlot } from '../../../src/stateful/SortedList.js';

/**
 * A framed frame refuses a record declared at a coordinate the transaction does not have.
 *
 * A master that settles alone walks only the transaction's own indices, so a declaration at any other coordinate is
 * never settled, and a body that reads its views takes them on the frame's word. A loop's later turns read a paged
 * mapping node that way: before the head held every declared index to the transaction, a turn declared at `0x8001`
 * (-1) read a value no input carried, and the frame wrote state from it. Each path that reads a declaration is
 * accepted with the record at a real index and refused with the same views declared at `0x8001` or `0x7fff`.
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
/** A negative index as the master reads it, and a positive one past every input and output. */
const NOWHERE = [0x8001, 0x7fff];
const EMPTY = new Uint8Array(0);

/** The declaration the records state, then one more at `coordinate` holding the views `forged` states. */
function forgedAt(records: readonly PlacedRecord[], coordinate: number, forged: PlacedRecord): RecordEntry[] {
  return [...declarationOf(records), {
    in: forged.in === undefined ? 0xffff : coordinate, out: coordinate,
    viewIn: forged.before ?? EMPTY, viewOut: forged.after,
  }];
}

describe('a paged read whose later turn is declared nowhere', () => {
  const pager = deployFramedMaster(`${PRAGMA} contract Pager { mapping(uint => uint) cells; uint total;`
    + ' function sum(uint start, uint n) { uint s = 0;'
    + '   for (uint i = 0; i < n; i = i + 1) { s = s + this.cells[start + i]; } this.total = s; } }', 'paged turn');
  const lock = pager.collectionLock('cells');
  const cell = (key: bigint, value: bigint): Uint8Array =>
    node(keyToSlot(encodeIntegerValue(key)), undefined, encodeIntegerValue(value));
  const args = [encodeIntegerValue(2n), encodeIntegerValue(0n)];
  const leading = [
    spent(pager.recordLock, 2, pager.record({ total: 0n }), pager.record({ total: 1010n })),
    spent(lock, 3, cell(0n, 10n)),
  ];
  const turn = spent(lock, 4, cell(1n, 1000n));

  it('accepts the turn\'s node spent at the index its declaration names', () => {
    expect(evaluateMasterSpend(pager, { args, records: [...leading, turn] })).toStrictEqual({ accepted: true });
  });

  it('refuses the same node declared at a coordinate no input or output has, with none spent', () => {
    for (const coordinate of NOWHERE) {
      expect(evaluateMasterSpend(pager, {
        args, records: leading, declared: forgedAt(leading, coordinate, turn),
      }).accepted, coordinate.toString(16)).toBe(false);
    }
  });
});

describe('a mapping write, in a run-time loop and as a batch target', () => {
  const HEADER = `${PRAGMA} contract Holder { struct Account { uint total; mapping(address => uint) parts; }`
    + ' Account acc; function set(';
  const single = deployFramedMaster(`${HEADER}address k, uint v) { acc.parts[k] = v; } }`, 'coordinate single');
  const looped = deployFramedMaster(`${HEADER}address[] ks, uint v) {`
    + ' for (uint i = 0; i < ks.length; i = i + 1) { acc.parts[ks[i]] = v; } } }', 'coordinate looped');
  const K = distinctBytes(20, 0x13);
  const slot = keyToSlot(K);
  const inserted = node(slot, undefined, encodeIntegerValue(42n));
  /** The data record a batch target's frame declares first, the predecessor it relinks, and the node it creates. */
  const insert = (master: DeployedMaster, base: number): PlacedRecord[] => [
    spent(master.collectionLock('acc__parts'), base, head(), head(slot)),
    created(master.collectionLock('acc__parts'), base + 1, inserted),
  ];
  const batch = (): PlacedRecord[] => [spent(single.recordLock, 2, single.record({ acc__total: 5n })), ...insert(single, 3)];
  const singleArgs = [encodeIntegerValue(42n), K];
  const loopArgs = [encodeIntegerValue(42n), encodePushdataValue([K], 'address[]')];

  it('accepts the insert with every record at a real index', () => {
    expect(evaluateMasterSpend(single, { args: singleArgs, records: batch() })).toStrictEqual({ accepted: true });
    expect(evaluateMasterSpend(looped, { args: loopArgs, records: insert(looped, 2) })).toStrictEqual({ accepted: true });
  });

  it('refuses the predecessor or the created node declared at a coordinate the transaction does not have', () => {
    for (const coordinate of NOWHERE) {
      const [record, predecessor, createdNode] = batch();
      expect(evaluateMasterSpend(single, {
        args: singleArgs, records: [record!, createdNode!],
        declared: [...forgedAt([record!], coordinate, predecessor!), ...declarationOf([createdNode!])],
      }).accepted).toBe(false);
      expect(evaluateMasterSpend(single, {
        args: singleArgs, records: [record!, predecessor!],
        declared: forgedAt([record!, predecessor!], coordinate, createdNode!),
      }).accepted).toBe(false);
      const [loopPredecessor, loopCreated] = insert(looped, 2);
      expect(evaluateMasterSpend(looped, {
        args: loopArgs, records: [loopCreated!],
        declared: [...forgedAt([], coordinate, loopPredecessor!), ...declarationOf([loopCreated!])],
      }).accepted).toBe(false);
      expect(evaluateMasterSpend(looped, {
        args: loopArgs, records: [loopPredecessor!], declared: forgedAt([loopPredecessor!], coordinate, loopCreated!),
      }).accepted).toBe(false);
    }
  });
});

describe('a data record and a chunk run', () => {
  const counter = deployFramedMaster(`${PRAGMA} contract Counter { uint n;`
    + ' function bump(uint x) { require(this.n == x); this.n = this.n + 1; } }', 'coordinate counter');
  const pair = deployFramedMaster(`${PRAGMA} contract Pair { bytes public data; bytes public other;`
    + ' function check(bytes value) { require(this.data == value); } }', 'coordinate pair');
  const blob = deployFramedMaster(`${PRAGMA} contract Blob { bytes public data;`
    + ' function set(bytes value) { this.data = value; } }', 'coordinate blob');
  const runOf = (master: DeployedMaster): ChunkRunContract => ({
    artifact: master.artifact, category: master.category, program: master.script, address: master.address,
    masterLock: master.lock,
  });
  const record = spent(counter.recordLock, 2, counter.record({ n: 5n }), counter.record({ n: 6n }));
  const VALUE = distinctBytes(6, 0x31);
  const header = spent(pair.recordLock, 2, lengthHeader(runOf(pair), { data: 6, other: 6 }));
  const kept = spent(chunkLock(runOf(pair), 'data', 'bytes'), 3, chunkCommitments(VALUE)[0]!);
  const SHORT = distinctBytes(5, 0x11);
  const LONG = distinctBytes(200, 0x17);
  const [first, second] = chunkCommitments(LONG);
  const grown = [
    spent(blob.recordLock, 2, lengthHeader(runOf(blob), { data: 5 }), lengthHeader(runOf(blob), { data: 200 })),
    spent(chunkLock(runOf(blob), 'data', 'bytes'), 3, chunkCommitments(SHORT)[0]!, first!),
  ];
  const minted = created(chunkLock(runOf(blob), 'data', 'bytes'), 4, second!);

  it('accepts each at the index its declaration names', () => {
    expect(evaluateMasterSpend(counter, { args: [encodeIntegerValue(5n)], records: [record] }))
      .toStrictEqual({ accepted: true });
    expect(evaluateMasterSpend(pair, { args: [VALUE], records: [header, kept] })).toStrictEqual({ accepted: true });
    expect(evaluateMasterSpend(blob, { args: [LONG], records: [...grown, minted] })).toStrictEqual({ accepted: true });
  });

  it('refuses the record, a read chunk or a created chunk declared where the transaction has no index', () => {
    for (const coordinate of NOWHERE) {
      expect(evaluateMasterSpend(counter, {
        args: [encodeIntegerValue(5n)], records: [], declared: forgedAt([], coordinate, record),
      }).accepted).toBe(false);
      expect(evaluateMasterSpend(pair, {
        args: [VALUE], records: [header], declared: forgedAt([header], coordinate, kept),
      }).accepted).toBe(false);
      expect(evaluateMasterSpend(blob, {
        args: [LONG], records: grown, declared: forgedAt(grown, coordinate, minted),
      }).accepted).toBe(false);
    }
  });
});
