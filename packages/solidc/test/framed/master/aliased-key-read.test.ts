import { describe, expect, it } from 'vitest';
import { encodeIntegerValue, type RecordEntry } from '@solidcash/utils';
import { keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import { compileString } from '../../../src/compiler.js';
import { FramedAliasedReadError } from '../../../src/Errors.js';
import {
  created, declarationOf, deployFramedMaster, evaluateMasterSpend, head, node, spent,
  type DeployedMaster, type PlacedRecord,
} from './record-spend.js';

/**
 * A framed body that reads one key of a verified mapping after it wrote another key of the mapping in the segment.
 *
 * The read proves its key against the view its segment declared before the write, and a segment may declare one node
 * twice: a predecessor that a read and an insert share is declared kept for the read and relinked for the insert, and
 * settlement chains the two. Where the two keys agree at run time, a transaction built by hand declares the written
 * node the same way, and the read would take the value from before the write, where the EVM's read takes the value
 * written. A write the entry cache takes reaches the entry only where the cache is flushed, after the read, so the
 * same holds for `m[a] -= x` (`CacheMappingEntryInLoop`). The frame compares the read's key hash with the write's
 * slot and refuses the run where they agree and the write ran. Distinct keys, a shared predecessor, a read before the
 * write and a write its arm skipped still settle. A write the frame holds no slot of, a loop's, is refused where the
 * body is compiled. Each verdict is the BCH-2026 machine's on the master's own input.
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
const STATE = ' uint count; mapping(uint => uint) balances;';
const ALIASED = deployFramedMaster(`${PRAGMA} contract Aliased {${STATE}`
  + ' function debit(uint a, uint b, uint x) { balances[a] = balances[a] - x; count = balances[b]; }'
  + ' function credit(uint a, uint b, uint x) { balances[a] = balances[a] + x; count = balances[b]; }'
  + ' function readThenDebit(uint a, uint b, uint x) { count = balances[b]; balances[a] = balances[a] - x; }'
  + ' }', 'aliased key read');
/** A cached write in an arm marks its cache dirty there; a write beside a field write keeps its own run flag. */
const CONDITIONAL = deployFramedMaster(`${PRAGMA} contract Conditional {${STATE} uint total;`
  + ' function maybeDebit(uint a, uint b, uint x, bool c) {'
  + '   if (c) { balances[a] = balances[a] - x; } count = balances[b]; }'
  + ' function maybeSet(uint a, uint b, uint x, bool c) { if (c) { balances[a] = x; total = x; } count = balances[b]; }'
  + ' }', 'aliased key read conditional');

const A = encodeIntegerValue(3n);
const B = encodeIntegerValue(5n);
const X = encodeIntegerValue(8n);
const YES = encodeIntegerValue(1n);
const NO = encodeIntegerValue(0n);
const SLOT_A = keyToSlotMulti([A]);
const SLOT_B = keyToSlotMulti([B]);
/** The data record, the node the read declares, and the output an insert creates its node at. */
const DATA_INDEX = 2;
const NODE_INDEX = 3;
const CREATED_INDEX = 4;

/** A node holding `value` at `slot`, its successor `+inf`. */
const nodeOf = (slot: Uint8Array, value: bigint): Uint8Array => node(slot, undefined, encodeIntegerValue(value));

/** The data record, rewritten from `count = 7` to `count`, and from `total = 0` to `total` where it has one. */
const data = (master: DeployedMaster, count: bigint, total?: bigint): PlacedRecord => spent(master.recordLock,
  DATA_INDEX, master.record({ count: 7n, ...(total === undefined ? {} : { total: 0n }) }),
  master.record({ count, ...(total === undefined ? {} : { total }) }));

/** The master whose data record `record` is. */
const master = (record: PlacedRecord): DeployedMaster => (record.lock === ALIASED.recordLock ? ALIASED : CONDITIONAL);

/** The data record, the read's node, then the written node one past it, rewritten from `before` to `after`. */
const twoNodes = (record: PlacedRecord, read: Uint8Array, before: Uint8Array, after: Uint8Array): PlacedRecord[] => [
  record, spent(master(record).collectionLock('balances'), NODE_INDEX, read),
  spent(master(record).collectionLock('balances'), NODE_INDEX + 1, before, after),
];

/**
 * A spend that names one node for the read and for the write: the node the read declares kept, then the same node in
 * the write's group, rewritten from `before` to `after`, and the node an insert creates, when there is one.
 */
function oneNode(record: PlacedRecord, before: Uint8Array, after: Uint8Array, insert?: Uint8Array): {
  records: PlacedRecord[]; declared: RecordEntry[];
} {
  const lock = master(record).collectionLock('balances');
  const records = [record, spent(lock, NODE_INDEX, before, after),
    ...(insert === undefined ? [] : [created(lock, CREATED_INDEX, insert)])];
  const [declaredRecord, target, ...rest] = declarationOf(records);
  return { records, declared: [declaredRecord!, { ...target!, viewOut: before }, target!, ...rest] };
}

const accepts = (
  on: DeployedMaster, entry: string, args: Uint8Array[], spend: { records: PlacedRecord[]; declared?: RecordEntry[] },
): boolean => evaluateMasterSpend(on, { entry, args, ...spend }).accepted;

describe('a framed read of one key after a write of another that names the same entry', () => {
  it('settles the read of a distinct key, which takes the value its own node holds', () => {
    const spend = (count: bigint): PlacedRecord[] =>
      twoNodes(data(ALIASED, count), nodeOf(SLOT_B, 9n), nodeOf(SLOT_A, 50n), nodeOf(SLOT_A, 42n));
    expect(accepts(ALIASED, 'debit', [X, B, A], { records: spend(9n) })).toBe(true);
    expect(accepts(ALIASED, 'debit', [X, B, A], { records: spend(10n) })).toBe(false);
  });

  it('refuses the read of the written key, whichever value the frame declares it took', () => {
    // Before the guard the frame accepted the first: the value from before the write, 50, where the EVM reads 42.
    const spend = (count: bigint): ReturnType<typeof oneNode> =>
      oneNode(data(ALIASED, count), nodeOf(SLOT_A, 50n), nodeOf(SLOT_A, 42n));
    expect(accepts(ALIASED, 'debit', [X, A, A], spend(50n))).toBe(false);
    expect(accepts(ALIASED, 'debit', [X, A, A], spend(42n))).toBe(false);
  });

  it('settles a distinct absent key whose predecessor the insert relinks, and refuses the inserted key', () => {
    const spend = (count: bigint): ReturnType<typeof oneNode> =>
      oneNode(data(ALIASED, count), head(), head(SLOT_A), nodeOf(SLOT_A, 8n));
    expect(accepts(ALIASED, 'credit', [X, B, A], spend(0n))).toBe(true);
    expect(accepts(ALIASED, 'credit', [X, B, A], spend(8n))).toBe(false);
    // The absence the predecessor's view proves is from before the insert: the EVM reads 8.
    expect(accepts(ALIASED, 'credit', [X, A, A], spend(0n))).toBe(false);
    expect(accepts(ALIASED, 'credit', [X, A, A], spend(8n))).toBe(false);
  });

  it('settles a read of the same entry before the write, which takes the value from before it', () => {
    const spend = (count: bigint): ReturnType<typeof oneNode> =>
      oneNode(data(ALIASED, count), nodeOf(SLOT_A, 50n), nodeOf(SLOT_A, 42n));
    expect(accepts(ALIASED, 'readThenDebit', [X, A, A], spend(50n))).toBe(true);
    expect(accepts(ALIASED, 'readThenDebit', [X, A, A], spend(42n))).toBe(false);
  });

  it('settles the read where the arm that writes the entry did not run, and refuses it where it did', () => {
    // `maybeDebit`'s write marks its cache dirty in the arm; `maybeSet`'s sets the write's own run flag there.
    for (const [entry, written] of [['maybeDebit', 42n], ['maybeSet', 8n]] as const) {
      const total = entry === 'maybeSet' ? 8n : undefined;
      const skipped = oneNode(data(CONDITIONAL, 50n, total === undefined ? undefined : 0n),
        nodeOf(SLOT_A, 50n), nodeOf(SLOT_A, 50n));
      expect(accepts(CONDITIONAL, entry, [NO, X, A, A], skipped)).toBe(true);
      for (const count of [50n, written]) {
        const ran = oneNode(data(CONDITIONAL, count, total), nodeOf(SLOT_A, 50n), nodeOf(SLOT_A, written));
        expect(accepts(CONDITIONAL, entry, [YES, X, A, A], ran)).toBe(false);
      }
      expect(accepts(CONDITIONAL, entry, [YES, X, B, A], {
        records: twoNodes(data(CONDITIONAL, 9n, total), nodeOf(SLOT_B, 9n), nodeOf(SLOT_A, 50n),
          nodeOf(SLOT_A, written)),
      })).toBe(true);
    }
  });
});

/** The aliased-read refusal a contract with `members` draws, or undefined when it compiles. */
function refusal(members: string): string | undefined {
  try {
    compileString(`${PRAGMA} contract Refused {${STATE}${members} }`, { composition: 'framed' });
    return undefined;
  } catch (error) {
    if (error instanceof FramedAliasedReadError) return error.message;
    throw error;
  }
}

describe('a framed read after a write of its collection the frame holds no slot of', () => {
  const LOOP = ' for (uint i = 0; i < ks.length; i++) { balances[ks[i]] = v; }';

  it('refuses a read after a loop\'s writes, naming the read and the write', () => {
    expect(refusal(` function f(uint[] ks, uint v, uint b) {${LOOP} count = balances[b]; }`)).toContain(
      'a read of `balances[b]` after a write of `balances[ks[i]]` in its segment is not supported on the framed '
      + 'convention, where the two keys may name one entry: read it before the write',
    );
  });

  it('compiles the read before the loop', () => {
    expect(refusal(` function f(uint[] ks, uint v, uint b) { count = balances[b];${LOOP} }`)).toBeUndefined();
  });
});
