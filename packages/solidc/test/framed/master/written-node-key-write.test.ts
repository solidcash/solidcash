import { describe, expect, it } from 'vitest';
import { encodeIntegerValue } from '@solidcash/utils';
import { keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import {
  created, declarationOf, deployFramedMaster, distinctBytes, evaluateMasterSpend, head, node, spent,
  type PlacedRecord,
} from './record-spend.js';
import { refusalMessageOf } from './refused-entry.js';

/**
 * A framed master whose entry writes a mapping keyed by a value it reads out of a node the same body writes.
 *
 * A deed's transfer debits the holder its record names, credits the recipient and moves the record:
 * `balances[owners[id]] -= 1; balances[to] += 1; owners[id] = to`, and its burn debits the holder and deletes the
 * record. The debit's key is read out of the `owners` node the body then rewrites, and a node the body writes is read
 * through the operands its own group yields. So the frame declares the `owners` group ahead of the `balances` groups
 * (the published batches carry that order), and the master derives in rounds: the groups whose keys it holds where
 * the body begins, then the debit's key, read out of the `owners` node as its group begins it (the value the body
 * reads before its write), then the debit's group. The debit's own write binds its key's hash to the derived slot,
 * so a debit of another party than the one the record names is refused by the frame. A mint keyed by its arguments
 * alone is one round, in the order the body writes it.
 *
 * Each case compiles the source with the framed convention, deploys the master the way a deployment does, and asks
 * the BCH-2026 machine for its verdict on the master's own input. The balance nodes of one transfer are linked as a
 * list holds them, since the batch's own walk holds its targets to one sorted list.
 */

const DEED = deployFramedMaster('pragma solidcash ^0.14.0;'
  + ' contract Deed {'
  + '   mapping(uint => address) owners;'
  + '   mapping(address => uint) balances;'
  + '   function mint(address to, uint id) { balances[to] += 1; owners[id] = to; }'
  + '   function transfer(address to, uint id) { balances[owners[id]] -= 1; balances[to] += 1; owners[id] = to; }'
  + '   function handOver(address to, uint id) {'
  + '     address holder = owners[id]; balances[holder] -= 1; balances[to] += 1; owners[id] = to;'
  + '   }'
  + '   function burn(uint id) { balances[owners[id]] -= 1; delete owners[id]; }'
  + ' }', 'written node key deed');

const ID = 7n;
const ZERO_SLOT = new Uint8Array(32);
const EMPTY = new Uint8Array(0);

const number = (value: bigint): Uint8Array => encodeIntegerValue(value);
const idSlot = keyToSlotMulti([number(ID)]);
const partySlot = (party: Uint8Array): Uint8Array => keyToSlotMulti([party]);
/** A slot's place in its list: the number its bytes encode, which the master compares. */
const slotValue = (slot: Uint8Array): bigint => slot.reduceRight((value, byte) => (value << 8n) | BigInt(byte), 0n);

/** Three parties, in the order their balance nodes take in the list. */
const [P0, P1, P2] = [distinctBytes(20, 0x31), distinctBytes(20, 0x55), distinctBytes(20, 0x77)]
  .sort((left, right) => (slotValue(partySlot(left)) < slotValue(partySlot(right)) ? -1 : 1)) as [
  Uint8Array, Uint8Array, Uint8Array,
];

const OWNERS = DEED.collectionLock('owners');
const BALANCES = DEED.collectionLock('balances');

/** The record of the deed, held by `holder` and left naming `next`, kept at input `at`. */
const record = (at: number, holder: Uint8Array, next: Uint8Array): PlacedRecord =>
  spent(OWNERS, at, node(idSlot, ZERO_SLOT, holder), node(idSlot, ZERO_SLOT, next));

/** A party's balance node at input `at`, linked to `next`, rewritten from `held` to `left`. */
const balance = (at: number, party: Uint8Array, held: bigint, left: bigint, next: Uint8Array = ZERO_SLOT): PlacedRecord =>
  spent(BALANCES, at, node(partySlot(party), next, number(held)), node(partySlot(party), next, number(left)));

/** A balance the party does not hold yet, spliced in after the list's head at input `at`, ahead of `first`. */
const opened = (at: number, party: Uint8Array, first: Uint8Array = ZERO_SLOT): PlacedRecord[] => [
  spent(BALANCES, at, head(first), head(partySlot(party))),
  created(BALANCES, at + 1, node(partySlot(party), first, number(1n))),
];

const verdictOf = (entry: string, args: readonly Uint8Array[], records: readonly PlacedRecord[]): {
  accepted: boolean; objection?: string;
} => {
  const { accepted, objection } = evaluateMasterSpend(DEED, { entry, args, records });
  return objection === undefined ? { accepted } : { accepted, objection };
};

/** `to` and `id` as an entry takes them, the deepest parameter first. */
const toward = (to: Uint8Array): Uint8Array[] => [number(ID), to];

describe('a framed master keyed by a value it reads out of a node the same body writes', () => {
  it('serves every entry, declaring the record\'s batch ahead of the balances whose key reads it', () => {
    expect(DEED.artifact.composition?.refusedEntries ?? []).toStrictEqual([]);
    const fn = (name: string): (typeof DEED.artifact.abi)[number] =>
      DEED.artifact.abi.find((candidate) => candidate.name === name)!;
    const order = (name: string): readonly string[] => (fn(name).sortedBatchInfo ?? [])
      .map((batch) => batch.collection);
    expect(order('mint')).toStrictEqual(['balances', 'owners']);
    for (const entry of ['transfer', 'handOver', 'burn']) {
      expect(order(entry)).toStrictEqual(['owners', 'balances']);
      const keys = (fn(entry).entryAccesses ?? []).filter((access) => access.collection === 'balances')
        .map((access) => access.keySources?.[0]?.expressionLabel ?? access.keyParams[0]);
      expect(keys).toContain('map:owners(id:id)');
    }
  });

  for (const entry of ['transfer', 'handOver']) {
    it(`${entry}: debits the holder the record names and moves the record, by rewrite and by insert`, () => {
      expect(verdictOf(entry, toward(P1), [
        record(2, P0, P1), balance(3, P1, 2n, 3n), balance(4, P0, 1n, 0n, partySlot(P1)),
      ])).toStrictEqual({ accepted: true });
      expect(verdictOf(entry, toward(P0), [
        record(2, P1, P0), ...opened(3, P0, partySlot(P1)), balance(5, P1, 4n, 3n),
      ])).toStrictEqual({ accepted: true });
      // The debit follows the record: one naming the other party debits that party.
      expect(verdictOf(entry, toward(P0), [
        record(2, P1, P0), balance(3, P0, 2n, 3n, partySlot(P1)), balance(4, P1, 1n, 0n),
      ])).toStrictEqual({ accepted: true });
    });

    it(`${entry}: refuses a debit of a party the record does not name`, () => {
      expect(verdictOf(entry, toward(P2), [
        record(2, P0, P2), balance(3, P2, 2n, 3n), balance(4, P1, 1n, 0n, partySlot(P2)),
      ]).accepted).toBe(false);
      expect(verdictOf(entry, toward(P0), [
        record(2, P2, P0), ...opened(3, P0, partySlot(P1)), balance(5, P1, 4n, 3n, partySlot(P2)),
      ]).accepted).toBe(false);
    });

    it(`${entry}: refuses a declaration naming another holder than the record the input holds`, () => {
      // The frame settles itself, so its first view of the record is held to the commitment the input carries; the
      // rest of the plan is the one a record naming P1 would take.
      const records = [record(2, P0, P2), balance(3, P2, 2n, 3n), balance(4, P1, 1n, 0n, partySlot(P2))];
      const declared = declarationOf(records).map((declaration, index) => (index === 0
        ? { ...declaration, viewIn: node(idSlot, ZERO_SLOT, P1) } : declaration));
      expect(evaluateMasterSpend(DEED, { entry, args: toward(P2), records, declared }).accepted).toBe(false);
    });
  }

  it('burn: debits the holder the record names and clears the record', () => {
    expect(verdictOf('burn', [number(ID)], [record(2, P0, EMPTY), balance(3, P0, 2n, 1n)]))
      .toStrictEqual({ accepted: true });
    expect(verdictOf('burn', [number(ID)], [record(2, P0, EMPTY), balance(3, P1, 2n, 1n)]).accepted).toBe(false);
  });

  it('mint (control): keyed by its arguments alone, credits the recipient and opens the record', () => {
    expect(verdictOf('mint', toward(P0), [
      ...opened(2, P0),
      spent(OWNERS, 4, head(), head(idSlot)),
      created(OWNERS, 5, node(idSlot, ZERO_SLOT, P0)),
    ])).toStrictEqual({ accepted: true });
  });
});

describe('a framed master refuses by name the keys it cannot derive out of a node the body writes', () => {
  const unit = (body: string): string => 'pragma solidcash ^0.14.0;'
    + ' interface IPing { function ping() external; }'
    + ' contract Registry {'
    + '   mapping(uint => address) owners; mapping(address => uint) balances;'
    + '   mapping(uint => uint) left; mapping(uint => uint) right;'
    + `   ${body}`
    + ' }';

  it('keys that read each other\'s nodes', () => {
    expect(refusalMessageOf(unit(
      'function swap(uint a) { left[right[a]] = 1; right[left[a]] = 2; left[a] = 3; right[a] = 4; }',
    ))).toBe('Registry.swap(): the body writes mappings \'left\', \'right\' whose keys read each other\'s nodes, and a '
      + 'master derives a key out of a node the body writes only once that node\'s group is derived');
  });

  it('a key read before a call the batch is written after', () => {
    expect(refusalMessageOf(unit('function handOver(IPing pinger, address to, uint id) {'
      + ' address holder = owners[id]; pinger.ping(); balances[holder] -= 1; owners[id] = to; }')))
      .toBe('Registry.handOver(): the body writes a mapping at slot 1 whose key 0 \'map:owners(id:id)\' reads the '
        + 'mapping entry \'owners\' at a node the body also writes, outside the segment the body\'s batch writes land '
        + 'in, and a master reads such a node for a key only in the segment it derives the batch from');
  });

  it('a key read after the body writes the node', () => {
    // The read takes the value the write left, not the one the record's group begins with.
    expect(refusalMessageOf(unit('function relink(address to, uint id) { owners[id] = to; balances[owners[id]] += 1; }')))
      .toMatch(/^Registry\.relink\(\): the body writes a mapping at slot 1 whose key 0 'map:owners\(id:id\)' /);
  });
});
