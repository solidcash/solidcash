import { describe, expect, it } from 'vitest';
import type { Artifact, PublishedRefusedEntry, PublishedWriteSegment } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';

/**
 * The write facts an entry publishes, for the three shapes a builder reads them for.
 *
 * A builder places the records an entry's own writes contribute in the segment each write lands in, so an entry
 * whose writes it cannot place is refused by name. The artifact distinguishes the three shapes it can state: a body
 * that writes no record of its own publishes an empty list, a body whose writes land in different segments
 * publishes one fact per write, and a body that writes one record in one segment publishes the single fact beside
 * the list. This file pins the first two: an entry that makes a call and writes nothing, and an entry whose mapping
 * write and dynamic run land in different segments.
 *
 * The publication facts are this file's subject. The machine verdict they are read for is the shipped call path's:
 * the run-time-loop upsert the fourth case publishes is accepted, and refused with one byte of the written record
 * changed, in `solidcash/test/framed/conformance/loop-upsert-settlement.test.ts` ("the machine accepts the
 * run-time-loop upsert, and refuses the record it wrote being changed"), and the same pair beside a call in
 * `solidcash/test/framed/conformance/loop-upsert-beside-call.test.ts`.
 */

/** One write as the artifact publishes it. */
type PublishedWrite = PublishedWriteSegment;

/** The writes the artifact publishes for one entry, keyed the way a builder reads the table. */
function publishedWrites(
  artifact: Pick<Artifact, 'composition'>,
  contractName: string,
  entryName: string,
): {
    readonly single?: number | 'last';
    readonly writes?: readonly PublishedWrite[];
    readonly refused: readonly PublishedRefusedEntry[];
  } {
  const { composition } = artifact;
  const entry = composition?.stopSites?.entries
    .find((candidate) => candidate.functionName === `${contractName}.${entryName}()`);
  return {
    ...(entry?.writeSegment === undefined ? {} : { single: entry.writeSegment }),
    ...(entry?.writeSegments === undefined ? {} : { writes: entry.writeSegments }),
    refused: (composition?.refusedEntries ?? [])
      .filter((refusal) => refusal.functionName.includes(`${contractName}.${entryName}`)),
  };
}

const PING = 'interface IOther { function ping() external; } contract Other { function ping() { require(true); } }';
const OTHER = '0x' + '11'.repeat(31) + 'ee';
const CALL = `IOther(${OTHER}).ping.call();`;

/** A ledger with one record, one dynamic value and one mapping, so one body can write any of them. */
const LEDGER = (members: string, body: string): string => `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   uint public count;'
  + '   string[] public names;'
  + '   mapping(address => uint) balances;'
  + members
  + '   function move(address to, uint amount) {'
  + body
  + '     require(true);'
  + '   }'
  + ' }';

// An entry that makes one call and writes no record of its own: its frame holds nothing to declare, which is a
// different fact from a write whose segment the source does not fix.
const CALLER_ONLY_SOURCE = LEDGER('', CALL);
// An entry that only reads: it makes no call and writes nothing, so a builder declares no record either.
const READER_ONLY_SOURCE = LEDGER('', 'require(this.count >= 0);');
// A mapping write in one segment beside a dynamic run the epilogue pins in another, with the entry's own record
// rebuilt where the run is: three writes, three facts, no single segment that states the entry.
const MAPPING_WITH_RUN_SOURCE = LEDGER('', `balances[to] = amount; ${CALL} this.names.push("hi");`);

// A mapping write inside a loop whose own body makes no call, with the entry's call after the loop. The write runs
// before the call, so it lands in the segment the frame opens with and a callee of the call sees it - which is the
// fact a builder declares the batch's records in. The machine's verdict on this shape is
// `solidcash/test/framed/conformance/loop-upsert-beside-call.test.ts`, which settles it through the head the
// genesis minted.
const LOOP_UPSERT_BESIDE_CALL_SOURCE = `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address to, uint amount, int turns) {'
  + '     for (int i = 0; i < turns; i = i + 1) { balances[to] = amount; }'
  + `     ${CALL}`
  + '     require(true);'
  + '   }'
  + ' }';
// The same body with a second call between the loop and the end: the write runs before both calls, so it lands in
// the segment the frame opens with however many calls follow it.
const LOOP_UPSERT_BETWEEN_CALLS_SOURCE = `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address to, uint amount, int turns) {'
  + '     for (int i = 0; i < turns; i = i + 1) { balances[to] = amount; }'
  + `     ${CALL}`
  + `     IOther(0x${'22'.repeat(31)}ee).ping.call();`
  + '     require(true);'
  + '   }'
  + ' }';

// The same loop with no call anywhere in the body: this is the runtime-loop-upsert shape whose well-formed spend
// the shipped call path settles and whose mutation it refuses (the first case of
// `solidcash/test/framed/conformance/loop-upsert-settlement.test.ts`). The body below is that guard's body, so the
// fact this file pins and the machine pair that file pins are about one shape.
const LOOP_UPSERT_ALONE_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address to, uint amount, int turns) {'
  + '     for (int i = 0; i < turns; i = i + 1) { balances[to] = amount; }'
  + '     require(turns > 0);'
  + '   }'
  + ' }';

const callerOnly = compileStringMulti(CALLER_ONLY_SOURCE, { composition: 'framed' }).Ledger!;
const readerOnly = compileStringMulti(READER_ONLY_SOURCE, { composition: 'framed' }).Ledger!;
const mappingWithRun = compileStringMulti(MAPPING_WITH_RUN_SOURCE, { composition: 'framed' }).Ledger!;
const loopUpsertBesideCall = compileStringMulti(LOOP_UPSERT_BESIDE_CALL_SOURCE, { composition: 'framed' }).Ledger!;
const loopUpsertBetweenCalls = compileStringMulti(LOOP_UPSERT_BETWEEN_CALLS_SOURCE, { composition: 'framed' })
  .Ledger!;
const loopUpsertAlone = compileStringMulti(LOOP_UPSERT_ALONE_SOURCE, { composition: 'framed' }).Ledger!;

describe('the write facts an entry publishes', () => {
  it('publishes an empty write list for an entry that writes no record of its own', () => {
    // The entry makes its one call and keeps every record its frame holds; the empty list is that fact, and the
    // builder does not read it as a write whose segment is unstated.
    expect(publishedWrites(callerOnly, 'Ledger', 'move')).toStrictEqual({ writes: [], refused: [] });
  });

  it('publishes an empty write list for an entry that only reads', () => {
    expect(publishedWrites(readerOnly, 'Ledger', 'move')).toStrictEqual({ writes: [], refused: [] });
  });

  it('publishes the segment a runtime-loop upsert beside a call lands in', () => {
    // The loop's own body makes no call and the loop runs before the entry's one call, so the write lands in the
    // segment the frame opens with: a callee of that call sees it, as on the EVM.
    expect(publishedWrites(loopUpsertBesideCall, 'Ledger', 'move')).toStrictEqual({
      single: 0,
      writes: [{ collection: 'balances', segment: 0 }],
      refused: [],
    });
    // The same body with a second call after the loop: the write still runs before every call, so it still lands
    // in the segment the frame opens with rather than one the calls open.
    expect(publishedWrites(loopUpsertBetweenCalls, 'Ledger', 'move')).toStrictEqual({
      single: 0,
      writes: [{ collection: 'balances', segment: 0 }],
      refused: [],
    });
  });

  it('publishes the segment a run-time loop upsert lands in, the shape the shipped path settles', () => {
    // No call in the body, so the write lands in the segment the frame opens with; the machine pair for this body
    // is the conformance guard's, which accepts the well-formed spend and refuses the mutated one.
    expect(publishedWrites(loopUpsertAlone, 'Ledger', 'move')).toStrictEqual({
      single: 0,
      writes: [{ collection: 'balances', segment: 0 }],
      refused: [],
    });
  });

  it('publishes one fact per write when the batch and the run land in different segments', () => {
    // The batch's write precedes the entry's call, so its records are declared in the segment the frame opens with;
    // the run the append grows is pinned by the epilogue in the segment the call opened, and the record whose field
    // the run holds is rebuilt there, so no single fact states the entry and each write names its own segment. The
    // frame reads that run apart from the batch, in the run's own segment, which the run's fact says.
    const published = publishedWrites(mappingWithRun, 'Ledger', 'move');
    expect(published.single).toBeUndefined();
    expect(published.writes).toStrictEqual([
      { collection: 'balances', segment: 0 },
      { record: 0, segment: 'last', writtenVariables: ['names'] },
      { variable: 'names', segment: 'last', apart: true },
    ]);
    expect(published.refused).toStrictEqual([]);
  });
});
