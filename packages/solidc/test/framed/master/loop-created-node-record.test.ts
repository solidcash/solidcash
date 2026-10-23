import { describe, expect, it } from 'vitest';
import { encodeIntegerValue, encodePushdataValue } from '@solidcash/utils';
import { keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import {
  created, deployFramedMaster, distinctBytes, evaluateMasterSpend, head, node, spent, type PlacedRecord,
} from './record-spend.js';

/**
 * Where a loop's freshly created nodes sit in the record list the frame declares.
 *
 * An entry that inserts into a mapping inside a run-time loop declares one record per turn, and each turn addresses
 * its own turn's record by position in that declaration. The control below is the same write written once, without
 * the loop: the batch path declares the contract's data record, the node its entry sits at, and then the record the
 * write creates. A frame whose only write is the loop names no data record, so its declaration opens with the node
 * its entry sits at and holds the created node after it; the data record the body never touches is not part of that
 * list, and a list that leads with it is refused.
 *
 * The verdicts are the machine's own on a hand-built witness taken from the shipped encoders, so the position a turn
 * resolves is measured rather than inferred from the emitter.
 */

const K = distinctBytes(20, 0x13);
const V = 42n;
const TOTAL = 5n;

const HEADER = 'pragma solidcash ^0.14.0; contract Holder { struct Account { uint total;'
  + ' mapping(address => uint) parts; } Account acc; function set(';

/** The control: one write, no loop. */
const SINGLE = deployFramedMaster(`${HEADER}address k, uint v) { acc.parts[k] = v; } }`, 'loop node single');
/** The same write made by a loop that takes one turn. */
const LOOPED = deployFramedMaster(
  `${HEADER}address[] ks, uint v) { for (uint i = 0; i < ks.length; i = i + 1) { acc.parts[ks[i]] = v; } } }`,
  'loop node looped',
);

const slot = keyToSlotMulti([K]);
const lockOf = (master: typeof SINGLE): Uint8Array => master.collectionLock('acc__parts');
const createdNode = (master: typeof SINGLE): PlacedRecord =>
  created(lockOf(master), 4, node(slot, undefined, encodeIntegerValue(V)));
/** The data record the control declares, which the loop's body never names. */
const dataRecord = (master: typeof SINGLE): PlacedRecord =>
  spent(master.recordLock, 2, master.record({ acc__total: TOTAL }));
/** The node the entry of both frames sits at, relinked to the key the write creates. */
const headRecord = (master: typeof SINGLE): PlacedRecord =>
  spent(lockOf(master), 3, head(), head(slot));

const loopArgs = [encodeIntegerValue(V), encodePushdataValue([K], 'address[]')];

describe('a loop insert', () => {
  it('declares the created node at the position the batch path does', () => {
    expect(evaluateMasterSpend(SINGLE, {
      args: [encodeIntegerValue(V), K],
      records: [dataRecord(SINGLE), headRecord(SINGLE), createdNode(SINGLE)],
    })).toStrictEqual({ accepted: true });
  });

  it('settles a loop whose declaration opens with the node its entry sits at', () => {
    expect(evaluateMasterSpend(LOOPED, {
      args: loopArgs, records: [headRecord(LOOPED), createdNode(LOOPED)],
    })).toStrictEqual({ accepted: true });
  });

  it('refuses a loop declaration that leads with a record the frame does not name', () => {
    expect(evaluateMasterSpend(LOOPED, {
      args: loopArgs, records: [dataRecord(LOOPED), headRecord(LOOPED), createdNode(LOOPED)],
    }).accepted).toBe(false);
  });
});
