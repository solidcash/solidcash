import { describe, expect, it } from 'vitest';
import { encodeIntegerValue } from '@solidcash/utils';
import { keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import {
  USER_LOCK, created, deployFramedMaster, distinctBytes, evaluateMasterSpend, head, node, spent,
  type PlacedRecord,
} from './record-spend.js';

/**
 * A framed master whose entry names a mapping node through three or four keys.
 *
 * `m[a][b][c]` is one node of one collection: its slot is the masked hash of the per-key hashes concatenated, in
 * source order, which is what the body's key hash computes and the SDK's `keyToSlotMulti` derives. The two-key
 * case is `composite-key-write.test.ts`; here the derivation hashes every key below the second level. The controls
 * pin the order the keys hash in, that every key is hashed (a prefix of the keys names another node), the value the
 * node carries and the group the segment declares.
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
const A = distinctBytes(20, 0x11);
const B = distinctBytes(20, 0x23);
const C = encodeIntegerValue(300n);
const D = distinctBytes(32, 0x35);
const V = 42n;
const OLD = 7n;

const THREE = deployFramedMaster(`${PRAGMA} contract Three {`
  + ' mapping(address => mapping(address => mapping(uint => uint))) m;'
  + ' function set(address a, address b, uint c, uint v) { m[a][b][c] = v; } }', 'deep keys three');
const THREE_BUMP = deployFramedMaster(`${PRAGMA} contract ThreeBump {`
  + ' mapping(address => mapping(address => mapping(uint => uint))) m;'
  + ' function bump(address a, address b, uint c, uint v) { m[a][b][c] = m[a][b][c] + v; } }', 'deep keys bump');
const FOUR = deployFramedMaster(`${PRAGMA} contract Four {`
  + ' mapping(address => mapping(address => mapping(uint => mapping(bytes32 => uint)))) m;'
  + ' function set(address a, address b, uint c, bytes32 d, uint v) { m[a][b][c][d] = v; } }', 'deep keys four');
const THREE_READ = deployFramedMaster(`${PRAGMA} contract ThreeRead {`
  + ' mapping(address => mapping(address => mapping(uint => uint))) m;'
  + ' mapping(address => uint) copies;'
  + ' function copy(address a, address b, uint c) { copies[a] = m[a][b][c]; } }', 'deep keys read');
const THREE_CLEAR = deployFramedMaster(`${PRAGMA} contract ThreeClear {`
  + ' mapping(address => mapping(address => mapping(uint => uint))) m;'
  + ' function clear(address a, address b, uint c) { delete m[a][b][c]; } }', 'deep keys clear');
const THREE_SENDER = deployFramedMaster(`${PRAGMA} contract ThreeSender {`
  + ' mapping(address => mapping(address => mapping(uint => uint))) m;'
  + ' function set(address b, uint c, uint v) { m[msg.sender][b][c] = v; } }', 'deep keys sender');

/** The pushes of `(a, b, c, v)`, deepest parameter first. */
const SET_ARGS = [encodeIntegerValue(V), C, B, A];
const SLOT = keyToSlotMulti([A, B, C]);
const SENTINEL_AT = 2;
const NODE_AT = 2;
const CREATED_AT = 3;

/** An insert into the empty list: the head relinked to the slot, then the created node. */
function insertOf(lock: Uint8Array, slot: Uint8Array, value: bigint): PlacedRecord[] {
  return [
    spent(lock, SENTINEL_AT, head(), head(slot)),
    created(lock, CREATED_AT, node(slot, undefined, encodeIntegerValue(value))),
  ];
}

/** An update of the node at `slot` from `before` to `after`. */
function updateOf(lock: Uint8Array, slot: Uint8Array, before: bigint, after: bigint): PlacedRecord {
  return spent(lock, NODE_AT, node(slot, undefined, encodeIntegerValue(before)),
    node(slot, undefined, encodeIntegerValue(after)));
}

describe('a three-key mapping write', () => {
  const lock = THREE.collectionLock('m');

  it('publishes one collection for every key level and the entry holding the three keys', () => {
    expect(THREE.artifact.stateLayout?.collections?.map((collection) => collection.signature))
      .toStrictEqual(['m:mapping(address => mapping(address => mapping(uint256 => uint256)))']);
    expect(THREE.artifact.abi.find((entry) => entry.name === 'set')?.inputs?.map((input) => input.name))
      .toStrictEqual(['a', 'b', 'c', 'v']);
  });

  it('derives the slot from all three keys and is accepted for an insert', () => {
    expect(evaluateMasterSpend(THREE, { args: SET_ARGS, records: insertOf(lock, SLOT, V) }))
      .toStrictEqual({ accepted: true });
  });

  it('refuses a node whose slot hashes the keys in another order', () => {
    for (const keys of [[B, A, C], [A, C, B], [C, B, A]]) {
      expect(evaluateMasterSpend(THREE, { args: SET_ARGS, records: insertOf(lock, keyToSlotMulti(keys), V) })
        .accepted).toBe(false);
    }
  });

  it('refuses a node whose slot hashes only a prefix of the keys', () => {
    // `m[a][b]` names no node of this collection: the slot of the first two keys is another value.
    expect(evaluateMasterSpend(THREE, { args: SET_ARGS, records: insertOf(lock, keyToSlotMulti([A, B]), V) })
      .accepted).toBe(false);
    expect(evaluateMasterSpend(THREE, { args: SET_ARGS, records: insertOf(lock, keyToSlotMulti([A]), V) })
      .accepted).toBe(false);
  });

  it('refuses a created node carrying a value the write did not compute', () => {
    expect(evaluateMasterSpend(THREE, { args: SET_ARGS, records: insertOf(lock, SLOT, V + 1n) }).accepted).toBe(false);
  });

  it('refuses a segment that declares no record, or only the relinked head', () => {
    expect(evaluateMasterSpend(THREE, { args: SET_ARGS, records: [] }).accepted).toBe(false);
    expect(evaluateMasterSpend(THREE, { args: SET_ARGS, records: insertOf(lock, SLOT, V).slice(0, 1) }).accepted)
      .toBe(false);
  });

  it('is accepted rewriting the node in place, and refuses another value', () => {
    expect(evaluateMasterSpend(THREE, { args: SET_ARGS, records: [updateOf(lock, SLOT, OLD, V)] }))
      .toStrictEqual({ accepted: true });
    expect(evaluateMasterSpend(THREE, { args: SET_ARGS, records: [updateOf(lock, SLOT, OLD, V + 1n)] }).accepted)
      .toBe(false);
  });
});

describe('a three-key target written from the value it holds', () => {
  const lock = THREE_BUMP.collectionLock('m');

  it('is accepted with the node carrying the value the read produced', () => {
    expect(evaluateMasterSpend(THREE_BUMP, { args: SET_ARGS, records: [updateOf(lock, SLOT, OLD, OLD + V)] }))
      .toStrictEqual({ accepted: true });
  });

  it('refuses another value, and the node of a key prefix', () => {
    expect(evaluateMasterSpend(THREE_BUMP, { args: SET_ARGS, records: [updateOf(lock, SLOT, OLD, OLD + V + 1n)] })
      .accepted).toBe(false);
    const prefix = keyToSlotMulti([A, B]);
    expect(evaluateMasterSpend(THREE_BUMP, { args: SET_ARGS, records: [updateOf(lock, prefix, OLD, OLD + V)] })
      .accepted).toBe(false);
  });
});

describe('a four-key mapping write', () => {
  const lock = FOUR.collectionLock('m');
  const args = [encodeIntegerValue(V), D, C, B, A];

  it('derives the slot from all four keys and is accepted for an insert', () => {
    expect(evaluateMasterSpend(FOUR, { args, records: insertOf(lock, keyToSlotMulti([A, B, C, D]), V) }))
      .toStrictEqual({ accepted: true });
  });

  it('refuses the slot of the first three keys and the slot of the keys in another order', () => {
    expect(evaluateMasterSpend(FOUR, { args, records: insertOf(lock, keyToSlotMulti([A, B, C]), V) }).accepted)
      .toBe(false);
    expect(evaluateMasterSpend(FOUR, { args, records: insertOf(lock, keyToSlotMulti([A, B, D, C]), V) }).accepted)
      .toBe(false);
  });
});

describe('a three-key read beside a write', () => {
  const sourceLock = THREE_READ.collectionLock('m');
  const copiesLock = THREE_READ.collectionLock('copies');
  const args = [C, B, A];
  const COPIES_SLOT = keyToSlotMulti([A]);

  /** The read node kept, then the insert of `copies[a]` carrying the value read. */
  function copyRecords(readSlot: Uint8Array): PlacedRecord[] {
    const held = node(readSlot, undefined, encodeIntegerValue(OLD));
    return [
      spent(sourceLock, 2, held),
      spent(copiesLock, 3, head(), head(COPIES_SLOT)),
      created(copiesLock, 4, node(COPIES_SLOT, undefined, encodeIntegerValue(OLD))),
    ];
  }

  it('reads the node the three keys name and is accepted', () => {
    expect(evaluateMasterSpend(THREE_READ, { args, records: copyRecords(SLOT) })).toStrictEqual({ accepted: true });
  });

  it('refuses a read node under a key prefix or under the keys in another order', () => {
    expect(evaluateMasterSpend(THREE_READ, { args, records: copyRecords(keyToSlotMulti([A, B])) }).accepted)
      .toBe(false);
    expect(evaluateMasterSpend(THREE_READ, { args, records: copyRecords(keyToSlotMulti([B, A, C])) }).accepted)
      .toBe(false);
  });
});

describe('a three-key removal', () => {
  const lock = THREE_CLEAR.collectionLock('m');
  const args = [C, B, A];

  it('writes the default value into the node the three keys name', () => {
    // `uint(0)` is the empty script number, so the node keeps only its slot and successor.
    const cleared = spent(lock, NODE_AT, node(SLOT, undefined, encodeIntegerValue(OLD)), node(SLOT));
    expect(evaluateMasterSpend(THREE_CLEAR, { args, records: [cleared] })).toStrictEqual({ accepted: true });
  });

  it('refuses the node kept at its old value', () => {
    expect(evaluateMasterSpend(THREE_CLEAR, { args, records: [updateOf(lock, SLOT, OLD, OLD)] }).accepted)
      .toBe(false);
  });
});

describe('a three-key write keyed first by the frame sender', () => {
  const lock = THREE_SENDER.collectionLock('m');
  const args = [encodeIntegerValue(V), C, B];

  it('hashes the sender the frame carries as the outer key and is accepted', () => {
    const slot = keyToSlotMulti([USER_LOCK, B, C]);
    expect(evaluateMasterSpend(THREE_SENDER, { args, records: [updateOf(lock, slot, OLD, V)] }))
      .toStrictEqual({ accepted: true });
  });

  it('refuses the node of another sender', () => {
    const other = keyToSlotMulti([distinctBytes(25, 0x47), B, C]);
    expect(evaluateMasterSpend(THREE_SENDER, { args, records: [updateOf(lock, other, OLD, V)] }).accepted)
      .toBe(false);
  });
});
