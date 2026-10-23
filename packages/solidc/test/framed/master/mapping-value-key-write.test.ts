import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import { encodeChunkableValueTail, encodeIntegerValue } from '@solidcash/utils';
import { keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import {
  created, declarationOf, deployFramedMaster, distinctBytes, evaluateMasterSpend, head, node, spent,
  type PlacedRecord,
} from './record-spend.js';
import { refusalMessageOf } from './refused-entry.js';

/**
 * A framed master whose entry writes a mapping keyed by a value it reads out of another mapping.
 *
 * "Credit the party the record names": `owed[deals[id].payee] += deals[id].amount`, and the same release through a
 * memory copy of the record (`Deal memory d = deals[id]; owed[d.payee] += d.amount`). The master derives the write's
 * target slot where the body begins, from the `deals` node the frame declares for the read: the read proves that node
 * is the one at `id` before the derivation hashes its `payee`, and the write binds its own key's hash to the slot, so
 * the group the frame declares is held to the deal the frame reads. The memory copy crashed code generation
 * (`Expected variable 'd' does not exist on the stack`) while the key it handed the derivation still named the copy;
 * the derivation now follows it to `deals[id]`. A key read out of a node the same body writes is derived once that
 * node's own group is (`written-node-key-write.test.ts`).
 *
 * Each case compiles the source with the framed convention, deploys the master the way a deployment does, and asks
 * the BCH-2026 machine for its verdict on the master's own input: the `deals` node kept ahead of the `owed` group.
 */

const ESCROW = deployFramedMaster('pragma solidcash ^0.14.0;'
  + ' contract Escrow {'
  + '   struct Deal { address payee; uint amount; }'
  + '   mapping(uint => Deal) deals;'
  + '   mapping(address => uint) owed;'
  + '   function release(uint id) { require(deals[id].amount > 0); owed[deals[id].payee] += deals[id].amount; }'
  + '   function releaseCopy(uint id) {'
  + '     Deal memory d = deals[id]; require(d.amount > 0); owed[d.payee] += d.amount;'
  + '   }'
  + ' }', 'mapping value key escrow');

const PAYEE = distinctBytes(20, 0x31);
const OTHER = distinctBytes(20, 0x77);
const AMOUNT = 50n;
const EARLIER = 7n;
const ZERO_SLOT = new Uint8Array(32);

const number = (value: bigint): Uint8Array => encodeIntegerValue(value);
const dealSlot = (id: bigint): Uint8Array => keyToSlotMulti([number(id)]);
const owedSlot = (party: Uint8Array): Uint8Array => keyToSlotMulti([party]);
/** A deal's node tail: the struct's pushes behind their four-byte length, held inline. */
const dealTail = (payee: Uint8Array, amount: bigint): Uint8Array => encodeChunkableValueTail(
  new Uint8Array([...encodeDataPush(payee), ...encodeDataPush(number(amount))]),
);

const DEALS = ESCROW.collectionLock('deals');
const OWED = ESCROW.collectionLock('owed');

/** The deal at `id`, kept as the read declares it, at input `at`. */
const dealAt = (id: bigint, payee: Uint8Array, at: number, next: Uint8Array = ZERO_SLOT): PlacedRecord =>
  spent(DEALS, at, node(dealSlot(id), next, dealTail(payee, AMOUNT)));

/** The credit the release writes for `party`: an insert into the empty list, or a rewrite of the node it holds. */
function credit(party: Uint8Array, held?: bigint): PlacedRecord[] {
  const slot = owedSlot(party);
  if (held === undefined) {
    return [spent(OWED, 3, head(), head(slot)), created(OWED, 4, node(slot, ZERO_SLOT, number(AMOUNT)))];
  }
  return [spent(OWED, 3, node(slot, ZERO_SLOT, number(held)), node(slot, ZERO_SLOT, number(held + AMOUNT)))];
}

const verdictOf = (entry: string, id: bigint, records: readonly PlacedRecord[]): {
  accepted: boolean; objection?: string;
} => {
  const { accepted, objection } = evaluateMasterSpend(ESCROW, { entry, args: [number(id)], records });
  return objection === undefined ? { accepted } : { accepted, objection };
};

describe('a framed master keyed by a value it reads out of another mapping', () => {
  it('compiles both spellings with the key published as the field of the record the body reads', () => {
    expect(ESCROW.artifact.composition?.refusedEntries ?? []).toStrictEqual([]);
    const label = (entry: string): string | undefined => ESCROW.artifact.abi.find((fn) => fn.name === entry)
      ?.entryAccesses?.find((access) => access.collection === 'owed')?.keySources?.[0]?.expressionLabel;
    expect(label('release')).toBe('field:payee(map:deals(id:id))');
    expect(label('releaseCopy')).toBe('field:payee(map:deals(id:id))');
  });

  for (const entry of ['release', 'releaseCopy']) {
    it(`${entry}: credits the payee the deal names, by insert and by rewrite`, () => {
      expect(verdictOf(entry, 1n, [dealAt(1n, PAYEE, 2), ...credit(PAYEE)])).toStrictEqual({ accepted: true });
      expect(verdictOf(entry, 1n, [dealAt(1n, PAYEE, 2), ...credit(PAYEE, EARLIER)]))
        .toStrictEqual({ accepted: true });
      // The slot follows the deal: one naming the other party credits that party.
      expect(verdictOf(entry, 1n, [dealAt(1n, OTHER, 2), ...credit(OTHER)])).toStrictEqual({ accepted: true });
    });

    it(`${entry}: refuses a credit to a party the deal does not name`, () => {
      expect(verdictOf(entry, 1n, [dealAt(1n, PAYEE, 2), ...credit(OTHER)]).accepted).toBe(false);
      expect(verdictOf(entry, 1n, [dealAt(1n, PAYEE, 2), ...credit(OTHER, EARLIER)]).accepted).toBe(false);
    });

    it(`${entry}: refuses another deal's node read for the one the call names`, () => {
      // Deal 2 names the other party. Declared for deal 1 it is not the node at deal 1's key, so it serves at most as
      // the bracket that proves deal 1 absent, and an absent deal's default amount fails the body's own check.
      expect(verdictOf(entry, 1n, [dealAt(2n, OTHER, 2), ...credit(OTHER)]).accepted).toBe(false);
    });

    it(`${entry}: refuses a declaration naming another payee than the node the input holds`, () => {
      // The frame settles itself, so its first view of the deal is held to the commitment the input carries.
      const records = [dealAt(1n, PAYEE, 2), ...credit(OTHER)];
      const forged = node(dealSlot(1n), ZERO_SLOT, dealTail(OTHER, AMOUNT));
      const declared = declarationOf(records).map((record, index) => (index === 0
        ? { ...record, viewIn: forged, viewOut: forged } : record));
      expect(evaluateMasterSpend(ESCROW, { entry, args: [number(1n)], records, declared }).accepted).toBe(false);
    });
  }
});

describe('a framed master keyed by a value it reads out of a node the same body writes', () => {
  it('serves the entry: the key is derived once the node\'s own group is (written-node-key-write)', () => {
    // A transfer debits the holder its token record names and then moves the record.
    const ledger = 'pragma solidcash ^0.14.0;'
      + ' contract Ledger {'
      + '   mapping(uint => address) owners;'
      + '   mapping(address => uint) balances;'
      + '   function transfer(address to, uint id) { balances[owners[id]] -= 1; balances[to] += 1; owners[id] = to; }'
      + ' }';
    expect(refusalMessageOf(ledger)).toBe('');
  });
});
