import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../src/compiler.js';

/**
 * The segment each write of a per-call entry lands in, as the artifact publishes it per write.
 *
 * An entry's writes need not all land in one segment: a write to a field whose bytes the record only sizes is
 * declared in the run's last segment the epilogue pins, while the sorted batch the body plans is declared in the
 * segment its own calls name. The artifact publishes one fact per write beside the entry's stop sites, so a builder
 * places each write's records in the segment its own code wrote it in rather than refusing the entry.
 */

/** One write as the artifact publishes it. */
interface PublishedWrite {
  readonly record?: number;
  readonly collection?: string;
  readonly variable?: string;
  readonly segment: number | 'last';
}

/** The identity a published write is looked up by. */
type WriteIdentity = Omit<PublishedWrite, 'segment'>;

/** The writes the artifact publishes for one entry, keyed the way a builder reads the table. */
function publishedWrites(
  artifact: { readonly composition?: unknown },
  contractName: string,
  entryName: string,
): { readonly single?: number | 'last'; readonly writes?: readonly PublishedWrite[] } {
  const entries = (artifact.composition as {
    readonly stopSites?: {
      readonly entries?: readonly {
        readonly functionName?: string;
        readonly writeSegment?: number | 'last';
        readonly writeSegments?: readonly PublishedWrite[];
      }[];
    };
  } | undefined)?.stopSites?.entries;
  const entry = entries?.find((candidate) => candidate.functionName === `${contractName}.${entryName}()`);
  return {
    ...(entry?.writeSegment === undefined ? {} : { single: entry.writeSegment }),
    ...(entry?.writeSegments === undefined ? {} : { writes: entry.writeSegments }),
  };
}

const PING = 'interface IOther { function ping(); } contract Other { function ping() { require(true); } }';
const OTHER = '0x' + '11'.repeat(31) + 'ee';

/** A ledger whose entries move a mapping entry, grow a dynamic array, and call another contract. */
const LEDGER = (body: string): string => `pragma solidcash ^0.13.0;${PING}`
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
const SIZED_THEN_MAPPING_SOURCE = LEDGER(`this.names.push("hi"); balances[to] = amount; ${CALL}`);
// The sized write follows the call, which pins its run in the segment the call opened rather than the next one.
const MAPPING_CALL_SIZED_SOURCE = LEDGER(`balances[to] = amount; ${CALL} this.names.push("hi");`);
// A record written in one segment beside a dynamic run written in the last: both the record and the run land in
// the segment the epilogue pins, and the batch keeps the segment its own write names.
const RECORD_AND_MAPPING_SOURCE = LEDGER(`this.count = 1; balances[to] = amount; ${CALL}`);
// An entry that writes both a fixed field and a sized one of the same record: the record is rebuilt once, where the
// run is pinned, so the fixed write is declared there too.
const FIXED_AND_SIZED_SOURCE = LEDGER(`this.count = 1; this.names.push("hi"); ${CALL}`);
// The batch's write sits in a loop over the caller's own array beside the call, so its target varies per turn and
// no segment index names where it lands: the entry publishes nothing and a builder keeps its refusal.
const VARYING_LOOP_SOURCE = `pragma solidcash ^0.13.0;${PING}`
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

const mappingThenSized = compileStringMulti(MAPPING_THEN_SIZED_SOURCE, { composition: 'per-call' }).Ledger!;
const sizedThenMapping = compileStringMulti(SIZED_THEN_MAPPING_SOURCE, { composition: 'per-call' }).Ledger!;
const mappingCallSized = compileStringMulti(MAPPING_CALL_SIZED_SOURCE, { composition: 'per-call' }).Ledger!;
const recordAndMapping = compileStringMulti(RECORD_AND_MAPPING_SOURCE, { composition: 'per-call' }).Ledger!;
const fixedAndSized = compileStringMulti(FIXED_AND_SIZED_SOURCE, { composition: 'per-call' }).Ledger!;
const varyingLoop = compileStringMulti(VARYING_LOOP_SOURCE, { composition: 'per-call' }).Ledger!;

/** The write a published fact names, so the facts can be keyed by the identity a builder looks one up by. */
const identityOf = (write: WriteIdentity): string => (write.record !== undefined ? `record:${write.record}`
  : write.collection !== undefined ? `mapping:${write.collection}` : `dynamic:${String(write.variable)}`);

/** The segment of one published write, or undefined when the entry publishes no such write. */
function segmentOf(artifact: { readonly composition?: unknown }, write: WriteIdentity): number | 'last' | undefined {
  const published = publishedWrites(artifact, 'Ledger', 'move');
  return published.writes?.find((candidate) => identityOf(candidate) === identityOf(write))?.segment;
}

describe('the segment each write of a per-call entry lands in, as an artifact publishes it', () => {
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

  it('publishes the run\'s last segment for a sized write that follows the entry\'s call', () => {
    // The call opens the second segment and the run is pinned in the last one the frame declares, so the batch's
    // write and the run's do not share a segment and no single fact states the entry.
    expect(publishedWrites(mappingCallSized, 'Ledger', 'move').single).toBeUndefined();
    expect(segmentOf(mappingCallSized, { collection: 'balances' })).toBe(0);
    expect(segmentOf(mappingCallSized, { variable: 'names' })).toBe('last');
    expect(segmentOf(mappingCallSized, { record: 0 })).toBe('last');
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

  it('publishes nothing for a batch write whose target varies per turn of a loop that calls', () => {
    // The loop body makes the call as well as the write (the fixture's own shape,
    // `.marketplace/contracts/MarketplaceV1.sol:474-497`: `whitelistWorkers[...] = true;` then
    // `publishJobEvent(...)` in one iteration), so the write's segment is decided at run time and no compile-time
    // walk can place it - `callFreeNestedBlocks` returns undefined for any loop whose body reaches a call
    // (`packages/solidc/src/per-call/master/support.ts:722`). The shape stays unstated by design, and that is a fact
    // about this body, not about the loop protocol: the same loop over a caller's array with NO call in its body is
    // planned by the per-call lane's call path - one node per element, each declared where the emitted per-turn
    // coordinate reads it - and it settles end to end, which
    // `solidcash/test/per-call/conformance/loop-upsert-settlement.test.ts` drives (machine accept beside a refused
    // mutation) and `solidcash/test/per-call/call/loop-turns.test.ts` pins for three elements. The variant here
    // additionally needs the hop's callee-frame planning, because a call inside the loop opens a segment per turn.
    expect(publishedWrites(varyingLoop, 'Ledger', 'move')).toStrictEqual({});
  });
});
