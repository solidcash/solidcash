import { describe, expect, it } from 'vitest';
import { encodeChunkableValueTail, encodeIntegerValue, encodePushdataValue } from '@solidcash/utils';
import { keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import {
  deployFramedMaster, evaluateMasterSpend, node, spent, type PlacedRecord,
} from './record-spend.js';

/**
 * A loop body that reads a mapping entry before writing it, so that each turn after the first reads what the turn
 * before wrote.
 *
 * `grow(k, t)` pushes onto `logs[k]` the length it reads there, `t` times. The key does not change across turns, so
 * the entry cache reads the entry once into a local, the turns read and push the local, and the body writes it once:
 * every turn sees the turn before's push, as the EVM's does. Pushing `t = 2` onto `[5]` leaves `[5, 1, 2]`; a frame
 * declaring `[5, 1, 1]`, what turns reading the entry from before the loop would push, is refused. `growAll(ks)`
 * does the same over an array of keys, where the cache does not reach: the compiler publishes it as a refused body,
 * since each turn would read the array value the frame declares once per slot. The shipped hop names both
 * (`solidcash/test/framed/edges/aliased-keys-edge.test.ts`).
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
const GROWER = deployFramedMaster(`${PRAGMA} contract Grower { uint public count; mapping(uint => uint8[]) logs;`
  + ' function grow(uint k, uint t) { for (uint i = 0; i < t; i++) { uint n = this.logs[k].length;'
  + '   this.logs[k].push(uint8(n)); } }'
  + ' function growAll(uint[] ks) { for (uint i = 0; i < ks.length; i++) { uint n = this.logs[ks[i]].length;'
  + '   this.logs[ks[i]].push(uint8(n)); } }'
  + ' }', 'loop carried read grower');

const ID = encodeIntegerValue(7n);
const SLOT = keyToSlotMulti([ID]);

/** The kept data record, then the node at `ID` rewritten from `[5]` to `after`. */
function grown(after: readonly bigint[]): PlacedRecord[] {
  const tail = (values: readonly bigint[]): Uint8Array =>
    encodeChunkableValueTail(encodePushdataValue([...values], 'uint8[]'));
  return [
    spent(GROWER.recordLock, 2, GROWER.record({ count: 0n })),
    spent(GROWER.collectionLock('logs'), 3, node(SLOT, undefined, tail([5n])), node(SLOT, undefined, tail(after))),
  ];
}

const accepts = (turns: bigint, after: readonly bigint[]): boolean =>
  evaluateMasterSpend(GROWER, { entry: 'grow', args: [encodeIntegerValue(turns), ID], records: grown(after) }).accepted;

describe('a loop body that reads a mapping entry before writing it', () => {
  it('serves an invariant key: each turn reads the length the turn before pushed', () => {
    expect(accepts(2n, [5n, 1n, 2n])).toBe(true);
    expect(accepts(2n, [5n, 1n, 1n])).toBe(false);
    expect(accepts(2n, [5n, 1n])).toBe(false);
    expect(accepts(1n, [5n, 1n])).toBe(true);
  });

  it('publishes the same loop over an array of keys as a refused body, naming the per-turn read', () => {
    const composition = GROWER.artifact.composition as
      { refusedEntries?: readonly { functionName: string; reason: string }[] } | undefined;
    expect(composition?.refusedEntries?.map((refused) => refused.functionName)).toStrictEqual(['Grower.growAll()']);
    expect(composition?.refusedEntries?.[0]?.reason).toMatch(/reads a long mapping value once per loop turn/);
  });
});
