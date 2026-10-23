import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';

/**
 * A mapping entry a framed body accesses on both sides of a call.
 *
 * A write that reads the entry it writes, a struct field write and a repeated write of one entry are lowered through a
 * cache the body reads once and writes back once. A call closes the segment the code before it runs in, and the callee
 * may read the entry back through the contract's getter or rewrite it by entering the contract again, so the cache
 * ends at each call between two of the entry's accesses: it is written back before the call and read again after it.
 * One cache held across the call published a single write past it, which showed the callee the entry as it was before
 * the body's first write and wrote back over the callee's own write. A frame settles its verified-mapping writes in one
 * segment, so writes on both sides of a call are refused by name; writes on one side and reads on the other settle in
 * the segment of the writes.
 */

const OTHER = '0x' + '11'.repeat(31) + 'ee';
const OTHER_SOURCE = 'interface IOther { function ping(); function take(uint v); function get() returns (uint); }'
  + ' contract Other {'
  + '   function ping() { require(true); }'
  + '   function take(uint v) { require(v > 0); }'
  + '   function get() returns (uint) { return 3; }'
  + ' }';
const CALL = `IOther(${OTHER}).ping.call();`;

/** A ledger whose `move` entry runs `body`. */
const LEDGER = (body: string): string => `pragma solidcash ^0.14.0;${OTHER_SOURCE}`
  + ' contract Ledger {'
  + '   struct Row { uint a; uint b; }'
  + '   mapping(address => uint) balances;'
  + '   mapping(address => bool) locked;'
  + '   mapping(address => Row) rows;'
  + '   function move(address to, uint amount) {'
  + body
  + '     require(true);'
  + '   }'
  + ' }';

/** What the frame's batch answers verified-mapping writes that land in more than one segment with. */
const IN_TWO_SEGMENTS = 'a verified-mapping write is derived from the segment its own code runs in, but the master makes '
  + 'external calls and the write does not precede them';

/** The segment the artifact publishes `collection`'s write of `move` in, and the reasons it refuses entries for. */
function published(artifact: Artifact, collection: string): { segment: unknown; refused: readonly string[] } {
  const entry = artifact.composition?.stopSites?.entries
    .find((candidate) => candidate.functionName === 'Ledger.move()');
  return {
    segment: entry?.writeSegments?.find((write) => write.collection === collection)?.segment,
    refused: (artifact.composition?.refusedEntries ?? []).map((refusal) => refusal.reason),
  };
}

const compile = (body: string): Artifact => compileStringMulti(LEDGER(body), {
  composition: 'framed', suppressWarnings: true,
}).Ledger!;

/** The entry refused for its writes landing in two segments, with no write published. */
function refusedInTwoSegments(body: string, collection: string): void {
  const { segment, refused } = published(compile(body), collection);
  expect(segment).toBeUndefined();
  expect(refused).toHaveLength(1);
  expect(refused[0]).toContain(IN_TWO_SEGMENTS);
}

describe('a framed entry cache a call runs between two accesses of', () => {
  it('refuses by name a compound update on both sides of a call', () => {
    refusedInTwoSegments(`balances[to] += 1; ${CALL} balances[to] += 2;`, 'balances');
  });

  it('refuses by name a guard set before a call and cleared after it', () => {
    refusedInTwoSegments(`require(!locked[to]); locked[to] = true; ${CALL} locked[to] = false;`, 'locked');
  });

  it('refuses by name a struct entry whose fields are written on both sides of a call', () => {
    refusedInTwoSegments(`rows[to].a = amount; ${CALL} rows[to].b = rows[to].a + 1;`, 'rows');
  });

  it('keeps on the entry the accesses of a loop whose body calls, which the batch cannot place', () => {
    const { segment, refused } = published(compile(
      `for (uint i = 0; i < amount; i = i + 1) { balances[to] += 1; ${CALL} }`,
    ), 'balances');
    expect(segment).toBeUndefined();
    expect(refused).toStrictEqual(['the body writes a verified mapping behind a call whose occurrence the source does '
      + 'not fix, and the derived operands cannot follow the segment the write lands in']);
  });

  it('publishes writes before a call in their own segment beside reads after it', () => {
    expect(published(compile(`balances[to] += 1; balances[to] += amount; ${CALL} require(balances[to] > 0);`),
      'balances')).toStrictEqual({ segment: 0, refused: [] });
    const loop = 'for (uint i = 0; i < amount; i = i + 1) { balances[to] += 1; }';
    expect(published(compile(`${loop} ${CALL} require(balances[to] > 0);`), 'balances'))
      .toStrictEqual({ segment: 0, refused: [] });
  });

  it('publishes writes after a call in their own segment beside reads before it', () => {
    expect(published(compile(`require(balances[to] == 0); ${CALL} balances[to] += 1; balances[to] += amount;`),
      'balances')).toStrictEqual({ segment: 1, refused: [] });
  });

  it('reads an argument from the cache the call follows, and starts one at a write whose value makes the call', () => {
    expect(published(compile(`balances[to] += 1; IOther(${OTHER}).take(balances[to]);`), 'balances'))
      .toStrictEqual({ segment: 0, refused: [] });
    expect(published(compile(`balances[to] = IOther(${OTHER}).get(); balances[to] += 1;`), 'balances'))
      .toStrictEqual({ segment: 1, refused: [] });
  });
});
