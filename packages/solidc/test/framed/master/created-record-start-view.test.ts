import { describe, expect, it } from 'vitest';
import { encodeIntegerValue, type RecordEntry } from '@solidcash/utils';
import { keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import {
  created, declarationOf, deployFramedMaster, distinctBytes, evaluateMasterSpend, head, node, spent,
  type PlacedRecord,
} from './record-spend.js';

/**
 * A record the transaction creates starts from nothing.
 *
 * A standalone master settles its own records: a declaration that names an input index must chain from the
 * commitment the transaction spends there, and a declaration that names only an output index creates the record, so
 * it must declare the empty commitment the create starts from. The create branch of the master's own settlement walk
 * holds a created record's declared start view to nothing, so a caller cannot make a fresh record appear to start
 * from a commitment no input carries.
 *
 * The case runs the shipped path: the source is compiled with the framed convention, deployed, and the machine's
 * verdict on the master's own input is the assertion. The positive control, the created record declared from the
 * empty commitment, sits beside the refusal: the same spend with that start view replaced.
 */

const K = distinctBytes(20, 0x13);
const V = 42n;
const TOTAL = 5n;
/** A commitment that names no record of the contract, offered as a created record's start. */
const NON_EMPTY_START = new Uint8Array([0x01]);
const EMPTY = new Uint8Array(0);

const MASTER = deployFramedMaster(
  'pragma solidcash ^0.14.0; contract Holder { struct Account { uint total; mapping(address => uint) parts; }'
  + ' Account acc; function set(address k, uint v) { acc.parts[k] = v; } }',
  'created record start view',
);

const args = [encodeIntegerValue(V), K];
const lock = MASTER.collectionLock('acc__parts');
const slot = keyToSlotMulti([K]);

/** An insert into the empty list: the head relinked to the key, then the node the write creates. */
function records(): PlacedRecord[] {
  return [
    spent(MASTER.recordLock, 2, MASTER.record({ acc__total: TOTAL })),
    spent(lock, 3, head(), head(slot)),
    created(lock, 4, node(slot, undefined, encodeIntegerValue(V))),
  ];
}

/** The write's honest declaration, with the created record's start view replaced by `startView`. */
function declaredWithCreatedStart(startView: Uint8Array): RecordEntry[] {
  return declarationOf(records()).map((entry): RecordEntry =>
    (entry.in === 0xffff ? { ...entry, viewIn: startView } : entry));
}

describe('a record the transaction creates', () => {
  it('is refused when its declared start view is not empty', () => {
    expect(evaluateMasterSpend(MASTER, {
      args, records: records(), declared: declaredWithCreatedStart(NON_EMPTY_START),
    }).accepted).toBe(false);
    // The same spend with the empty start view settles, so the refusal is the created record's own declaration.
    expect(evaluateMasterSpend(MASTER, {
      args, records: records(), declared: declaredWithCreatedStart(EMPTY),
    }).accepted).toBe(true);
  });
});
