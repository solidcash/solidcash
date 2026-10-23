import { describe, expect, it } from 'vitest';
import { encodeIntegerValue } from '@solidcash/utils';
import { keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { deployFramedMaster, evaluateMasterSpend, node, spent } from './record-spend.js';

const master = deployFramedMaster(`pragma solidcash ^0.14.0;
  contract Ledger {
    int stored;
    mapping(int => int) m;
    function readIf(int k, int expected, bool go) {
      if (!go) { return; }
      require(m[k] == expected);
    }
  }`, 'audit exempt return');

describe('SEM-1 framed exempt return', () => {
  it('settles unchanged records and refuses a rewritten mapping or data record on the return path', () => {
    const lock = master.collectionLock('m');
    const slot = keyToSlot(encodeIntegerValue(7n));
    const before = node(slot, undefined, encodeIntegerValue(11n));
    const unchanged = [spent(master.recordLock, 2, master.record({ stored: 42n })), spent(lock, 3, before)];
    const args = [encodeIntegerValue(0n), encodeIntegerValue(999n), encodeIntegerValue(7n)];
    expect(evaluateMasterSpend(master, { args, records: unchanged }).accepted).toBe(true);
    const mappingMutation = [unchanged[0], spent(lock, 3, before, node(slot, undefined, encodeIntegerValue(22n)))];
    expect(evaluateMasterSpend(master, { args, records: mappingMutation }).accepted).toBe(false);
    const dataMutation = [spent(master.recordLock, 2, master.record({ stored: 42n }), master.record({ stored: 43n })),
      unchanged[1]];
    expect(evaluateMasterSpend(master, { args, records: dataMutation }).accepted).toBe(false);
  });
});
