import { describe, expect, it } from 'vitest';
import type { Artifact, PublishedWriteSegment } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';

/**
 * The segment each write of a framed entry lands in, as the artifact publishes it per write.
 *
 * An entry's writes need not all land in one segment: a write to a field whose bytes the record only sizes is
 * declared in the run's last segment the epilogue pins, while the sorted batch the body plans is declared in the
 * segment its own calls name. The artifact publishes one fact per write beside the entry's stop sites, so a builder
 * places each write's records in the segment its own code wrote it in rather than refusing the entry.
 *
 * The calls that decide a write's segment need not all stand on the same side of it. A write no call site follows is
 * declared in the segment the run's own call count names, whatever arms the execution took and however many turns a
 * calling loop before it made, which is what a batch write behind a body-wide re-entrancy check reads, and the check's
 * own restore; a write with calls on both sides names no segment and the contract refuses the entry by name.
 */

/** One write as the artifact publishes it. */
type PublishedWrite = PublishedWriteSegment;

/** The identity a published write is looked up by. */
type WriteIdentity = Omit<PublishedWrite, 'segment'>;

/** The writes the artifact publishes for one entry, keyed the way a builder reads the table. */
function publishedWrites(
  artifact: Pick<Artifact, 'composition'>,
  contractName: string,
  entryName: string,
): { readonly single?: number | 'last'; readonly writes?: readonly PublishedWrite[] } {
  const entry = artifact.composition?.stopSites?.entries
    .find((candidate) => candidate.functionName === `${contractName}.${entryName}()`);
  return {
    ...(entry?.writeSegment === undefined ? {} : { single: entry.writeSegment }),
    ...(entry?.writeSegments === undefined ? {} : { writes: entry.writeSegments }),
  };
}

const PING = 'interface IOther { function ping(); } contract Other { function ping() { require(true); } }';
const OTHER = '0x' + '11'.repeat(31) + 'ee';

/** A ledger whose entries move a mapping entry, grow a dynamic array, and call another contract. */
const LEDGER = (body: string): string => `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   uint public count;'
  + '   string[] public names;'
  + '   mapping(address => uint) balances;'
  + '   function move(address to, uint amount) {'
  + body
  + '     require(true);'
  + '   }'
  + ' }';

const CALL = `IOther(${OTHER}).ping.call();`;

// The mapping write precedes the entry's only call, so the batch's records are declared in the segment the frame
// opens with, while the run the dynamic write grows is pinned by the epilogue in the segment the call opens.
const MAPPING_THEN_SIZED_SOURCE = LEDGER(`balances[to] = amount; this.names.push("hi"); ${CALL}`);
// The same two writes in the other source order: the segment of a sized field's write does not follow the source.
// (The sized write after the call, on this ledger, is `write-shape-publication.test.ts`'s one-fact-per-write case.)
const SIZED_THEN_MAPPING_SOURCE = LEDGER(`this.names.push("hi"); balances[to] = amount; ${CALL}`);
// A record written in one segment beside a dynamic run written in the last: both the record and the run land in
// the segment the epilogue pins, and the batch keeps the segment its own write names.
const RECORD_AND_MAPPING_SOURCE = LEDGER(`this.count = 1; balances[to] = amount; ${CALL}`);
// An entry that writes both a fixed field and a sized one of the same record: the record is rebuilt once, where the
// run is pinned, so the fixed write is declared there too.
const FIXED_AND_SIZED_SOURCE = LEDGER(`this.count = 1; this.names.push("hi"); ${CALL}`);
// The batch's write sits in a loop over the caller's own array beside the call, so its target varies per turn and
// no one segment index names where it lands: the entry publishes where each turn writes instead.
const VARYING_LOOP_SOURCE = `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   uint public count;'
  + '   mapping(address => uint) balances;'
  + '   function move(address[] workers, uint amount) {'
  + '     for (int i = 0; i < workers.length; i = i + 1) {'
  + '       balances[workers[i]] = amount;'
  + `       IOther(${OTHER}).ping.call();`
  + '     }'
  + '     require(true);'
  + '   }'
  + ' }';

const mappingThenSized = compileStringMulti(MAPPING_THEN_SIZED_SOURCE, { composition: 'framed' }).Ledger!;
const sizedThenMapping = compileStringMulti(SIZED_THEN_MAPPING_SOURCE, { composition: 'framed' }).Ledger!;
const recordAndMapping = compileStringMulti(RECORD_AND_MAPPING_SOURCE, { composition: 'framed' }).Ledger!;
const fixedAndSized = compileStringMulti(FIXED_AND_SIZED_SOURCE, { composition: 'framed' }).Ledger!;
const varyingLoop = compileStringMulti(VARYING_LOOP_SOURCE, { composition: 'framed' }).Ledger!;

/**
 * A ledger whose body sets a record, calls under a condition, writes a mapping, and restores the record.
 *
 * The two writes to `count` sit at the body's ends, so that record lands in the segment the frame opens with and in
 * the last one the run opens, while the batch's write follows every call site. This is the shape a body-wide
 * re-entrancy check leaves behind, and it is the shape whose facts a builder reads when its entry has no single
 * segment: the record names both of its landings, so a builder chains them and leaves the value between them to the
 * body that computes it.
 */
const GUARDED_LEDGER = (condition: string): string => `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   uint public count;'
  + '   mapping(address => uint) balances;'
  + '   function move(address to, uint amount, bool take) {'
  + '     this.count = 1;'
  + `     ${condition}`
  + '     balances[to] = amount;'
  + '     this.count = 0;'
  + '     require(true);'
  + '   }'
  + ' }';
// The count before the batch's write varies with the arm the execution took, while no call site stands after it.
const GUARDED_ONE_ARM_SOURCE = GUARDED_LEDGER(`if (take) { ${CALL} }`);
const GUARDED_TWO_ARMS_SOURCE = GUARDED_LEDGER(`if (take) { ${CALL} } else { require(amount > 0); }`);
// The batch's write stands between two conditional calls: a call precedes it on one path and follows it on another,
// so no segment the run opens is its own and the entry publishes no fact.
const GUARDED_BETWEEN_SOURCE = `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address to, uint amount, bool first, bool second) {'
  + `     if (first) { ${CALL} }`
  + '     balances[to] = amount;'
  + `     if (second) { ${CALL} }`
  + '     require(true);'
  + '   }'
  + ' }';

const guardedOneArm = compileStringMulti(GUARDED_ONE_ARM_SOURCE, { composition: 'framed' }).Ledger!;
const guardedTwoArms = compileStringMulti(GUARDED_TWO_ARMS_SOURCE, { composition: 'framed' }).Ledger!;
const guardedBetween = compileStringMulti(GUARDED_BETWEEN_SOURCE, { composition: 'framed' }).Ledger!;

/**
 * A ledger whose body sets a record, calls once per turn of a loop, and restores the record, with `after` past the
 * restore: the loop's own bound decides how many calls stand before the restore.
 */
const GUARDED_LOOP_SOURCE = (after: string): string => `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   uint public count;'
  + '   function move(int turns) {'
  + '     this.count = 1;'
  + `     for (int i = 0; i < turns; i = i + 1) { ${CALL} }`
  + '     this.count = 0;'
  + `     ${after}`
  + '     require(true);'
  + '   }'
  + ' }';

const guardedLoop = compileStringMulti(GUARDED_LOOP_SOURCE(''), { composition: 'framed' }).Ledger!;
const guardedLoopThenCall = compileStringMulti(GUARDED_LOOP_SOURCE(CALL), { composition: 'framed' }).Ledger!;

/** The write a published fact names, so the facts can be keyed by the identity a builder looks one up by. */
const identityOf = (write: WriteIdentity): string => (write.record !== undefined ? `record:${write.record}`
  : write.collection !== undefined ? `mapping:${write.collection}` : `dynamic:${String(write.variable)}`);

/** The segment of one published write, or undefined when the entry publishes no such write. */
function segmentOf(artifact: Pick<Artifact, 'composition'>, write: WriteIdentity): number | 'last' | undefined {
  const published = publishedWrites(artifact, 'Ledger', 'move');
  return published.writes?.find((candidate) => identityOf(candidate) === identityOf(write))?.segment;
}

/** Every segment one write is published at, in the order the artifact lists them. */
function segmentsOf(
  artifact: Pick<Artifact, 'composition'>,
  write: WriteIdentity,
): readonly (number | 'last')[] {
  const published = publishedWrites(artifact, 'Ledger', 'move');
  return (published.writes ?? []).filter((candidate) => identityOf(candidate) === identityOf(write))
    .map((candidate) => candidate.segment);
}

describe('the segment each write of a framed entry lands in, as an artifact publishes it', () => {
  it('names the batch\'s segment and the run\'s last segment for a mapping node and a sized field', () => {
    // The mapping write precedes the entry's one call, and the run the sized field grows is pinned at the end.
    expect(segmentOf(mappingThenSized, { collection: 'balances' })).toBe(0);
    expect(segmentOf(mappingThenSized, { variable: 'names' })).toBe('last');
    expect(segmentOf(mappingThenSized, { record: 0 })).toBe('last');
    // The entry writes one record the batch's own source order does not place, so one fact cannot state them all.
    expect(publishedWrites(mappingThenSized, 'Ledger', 'move').single).toBeUndefined();
  });

  it('publishes the same facts whichever of the two writes the source makes first', () => {
    expect(segmentOf(sizedThenMapping, { collection: 'balances' })).toBe(0);
    expect(segmentOf(sizedThenMapping, { variable: 'names' })).toBe('last');
    expect(segmentOf(sizedThenMapping, { record: 0 })).toBe('last');
  });

  it('names the segment of the fixed record and of the batch when they share one', () => {
    expect(segmentOf(recordAndMapping, { record: 0 })).toBe(0);
    expect(segmentOf(recordAndMapping, { collection: 'balances' })).toBe(0);
    expect(segmentOf(recordAndMapping, { variable: 'names' })).toBeUndefined();
  });

  it('names the run\'s last segment for a record whose fields are written in one, dynamic register', () => {
    // The record is rebuilt once, where its dynamic field's run is pinned, so the fixed field's write lands there.
    expect(segmentOf(fixedAndSized, { record: 0 })).toBe('last');
    expect(segmentOf(fixedAndSized, { variable: 'names' })).toBe('last');
  });

  it('publishes each turn\'s segment for a write whose target varies per turn of a loop that calls', () => {
    // The loop body makes the call as well as the write (the fixture's own shape,
    // `.marketplace/contracts/MarketplaceV1.sol:474-497`: `whitelistWorkers[...] = true;` then
    // `publishJobEvent(...)` in one iteration), so a turn writes in the segment its own call closes: turn `t` in the
    // one `site`'s `t`-th call closes, which a builder knows from the calls it plans (`loop-turn-segments.test.ts`).
    expect(publishedWrites(varyingLoop, 'Ledger', 'move')).toStrictEqual({
      writes: [{ segment: 0, turns: { collection: 'balances', slot: 0, site: 0, stride: 1 } }],
    });
  });

  it('names both segments of a record its body writes at both ends, and the run\'s last for the batch', () => {
    // The batch's write follows every call site, so it is declared in the segment the run's own call count names,
    // whichever arm the execution took; the record written at both ends is closed in both of them, so its own two
    // landings are published and a builder chains the declarations rather than guessing the value between them.
    expect(segmentOf(guardedOneArm, { collection: 'balances' })).toBe('last');
    expect(segmentsOf(guardedOneArm, { record: 0 })).toStrictEqual([0, 'last']);
    expect(publishedWrites(guardedOneArm, 'Ledger', 'move').single).toBeUndefined();
    expect(segmentOf(guardedTwoArms, { collection: 'balances' })).toBe('last');
    expect(segmentsOf(guardedTwoArms, { record: 0 })).toStrictEqual([0, 'last']);
  });

  it('names both ends of a record its body writes around a loop whose turns call', () => {
    // No call site stands after the restore, so it lands in the run's last segment however many turns called.
    expect(segmentsOf(guardedLoop, { record: 0 })).toStrictEqual([0, 'last']);
    expect(publishedWrites(guardedLoop, 'Ledger', 'move').single).toBeUndefined();
    // A call after the restore leaves it in no segment the source fixes, so the entry publishes no fact.
    expect(publishedWrites(guardedLoopThenCall, 'Ledger', 'move')).toStrictEqual({});
  });

  it('refuses by name the batch write a call on either side of it reaches, at any segment', () => {
    // A call precedes the write on one path and follows it on another, so no segment the run opens is its own: the
    // entry publishes no fact and the contract names the shape its own derivation cannot follow.
    expect(publishedWrites(guardedBetween, 'Ledger', 'move')).toStrictEqual({});
    expect((guardedBetween.composition?.refusedEntries ?? []).map((refusal) => refusal.reason)).toStrictEqual([
      'the body writes a verified mapping behind a call whose occurrence the source does not fix, and the derived '
      + 'operands cannot follow the segment the write lands in',
    ]);
  });
});
