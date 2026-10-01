import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  callerFields, edgeDeployment, eventsOnChain, expectRefusedEdge, readCallee, settleEdge,
} from './edge-harness.js';

/**
 * Spec section 22: a struct with dynamic members crossing a call edge, and the value the callee returns for it.
 *
 * `Desk` sits behind its proxy and calls `Archive`, deployed on its own. `post` passes the struct the user gave it,
 * two `bytes` members and a `string` beside a number, to `Archive.append`, a payable entry the call enters with
 * value 0: the callee appends it to one id's array, emits it, and returns the array's length, which the desk stores
 * (the catalog's job-event edge, a struct with two `bytes` fields appended to one array, and its payment edge, a
 * struct with a `string` whose call returns a number). `postBuilt` builds the struct from its own arguments where it
 * calls, and `postKeyed` from a local the call also passes as its key. What the edge left is read back from the
 * chain: the desk's record, the archive's array through the shipped read path, and the archive's events from the live
 * outputs at their covenant. A struct the callee's own check rejects is refused with its reason, and nothing is
 * broadcast.
 *
 * Known walls, each pinned with the refusal the shipped path raises today:
 * - Two appends to one id in one transaction (the job-event edge's loop). The hop plans each reach of a node whose
 *   value chunks from the value the deployment holds, so the second reach cannot continue from the first's; it
 *   refuses by name. Owner: the SDK hop (`proxy/external-calls.ts`, `requireSettledNodeChains`).
 * - The returned value written straight to a state field (`this.lastLength = IArchive(this.archive).append(id, n)`,
 *   the market's `job.escrowId = unicrow.pay(...)`). The compiler publishes that write in the segment before the call
 *   (`writeSegments` names segment 0) while the body writes it after the call returns, so the hop declares the record
 *   in the wrong segment and the entry never settles. The same write spelled through a local is published in
 *   segment 1 and settles above. Owner: the compiler's write-segment publication
 *   (`solidc/src/per-call/master/support.ts`, `perCallWriteSteps` places a write by the calls before its statement,
 *   not counting a call its own right-hand side makes).
 */

// `append` reads the length before its push: read after it in the same body, a per-call master answers the length
// the array had before the push (reported beside this replica; not an edge shape).
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' struct Note { int kind; bytes from; bytes body; string memo; }'
  + ' interface IArchive { function append(int id, Note n) payable returns (int); }'
  + ' contract Archive {'
  + '   int public floor;'
  + '   mapping(int => Note[]) logs;'
  + '   event Appended(int id, int kind, bytes from, bytes body, string memo);'
  + '   function append(int id, Note n) payable returns (int) {'
  + '     require(msg.value == 0, "value sent");'
  + '     require(n.kind > this.floor, "kind not set");'
  + '     int length = this.logs[id].length + 1;'
  + '     this.logs[id].push(n);'
  + '     emit Appended(id, n.kind, n.from, n.body, n.memo);'
  + '     return length;'
  + '   }'
  + '   function countOf(int id) view returns (int) { return this.logs[id].length; }'
  + '   function noteAt(int id, int index) view returns (Note) { return this.logs[id][index]; }'
  + ' }'
  + ' contract Desk {'
  + '   address public implementation;'
  + '   address public archive;'
  + '   int public posted;'
  + '   int public lastLength;'
  + '   function initialize(address a) { this.archive = a; require(true); }'
  + '   function post(int id, Note n) {'
  + '     int length = IArchive(this.archive).append(id, n);'
  + '     this.lastLength = length;'
  + '     this.posted = this.posted + 1;'
  + '   }'
  + '   function postBuilt(int id, int kind, bytes from, bytes body, string memo) {'
  + '     int length = IArchive(this.archive).append(id, Note(kind, from, body, memo));'
  + '     this.lastLength = length;'
  + '     this.posted = this.posted + 1;'
  + '   }'
  + '   function postKeyed(int id, bytes from, bytes body, string memo) {'
  + '     int key = id + 1;'
  + '     int length = IArchive(this.archive).append(key, Note(key, from, body, memo));'
  + '     this.lastLength = length;'
  + '     this.posted = this.posted + 1;'
  + '   }'
  + '   function postTwice(int id, Note first, Note second) {'
  + '     int one = IArchive(this.archive).append(id, first);'
  + '     int two = IArchive(this.archive).append(id, second);'
  + '     this.lastLength = two;'
  + '     this.posted = this.posted + two - one + 1;'
  + '   }'
  + '   function postDirect(int id, Note n) { this.lastLength = IArchive(this.archive).append(id, n); }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const deployed = edgeDeployment({
  scope: 'struct argument edge', callee: artifacts.Archive!, caller: artifacts.Desk!, interfaceName: 'IArchive',
});

/** One entry's published stop-site facts: the segment each of its own writes is declared in. */
interface PublishedEntry {
  readonly functionName: string;
  readonly writeSegments?: readonly { readonly record?: number; readonly segment: number | 'last' }[];
}

const LOG_ID = 7n;
const FIRST = { kind: 2n, from: hexToBin('a1b2c3d4'), body: hexToBin('0102030405'), memo: 'first note' };
const SECOND = { kind: 5n, from: hexToBin('0e0f'), body: hexToBin('6a6b6c6d6e6f'), memo: 'second note' };

describe('a struct argument with two bytes members and a string', () => {
  it('reaches the callee whole, is appended and emitted, and the length it returns reaches the caller', async () => {
    const run = await deployed();
    const result = await settleEdge(run, 'post', [LOG_ID, FIRST]);
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Archive.append()', 'Desk.post()', 'DeskProxy.__fallback()']);
    expect(await callerFields(run)).toMatchObject({ posted: 1n, lastLength: 1n });
    expect(await readCallee(run, 'countOf', [LOG_ID])).toStrictEqual([1n]);
    expect(await readCallee(run, 'noteAt', [LOG_ID, 0n])).toStrictEqual([FIRST]);
    expect((await eventsOnChain(run, run.callee, run.calleeCategoryId, result.txid))
      .map(({ name, args }) => ({ name, args }))).toStrictEqual([
      { name: 'Appended', args: { id: LOG_ID, ...FIRST } },
    ]);
  });

  it('carries a struct the caller builds from its own arguments, appended after the first', async () => {
    const run = await deployed();
    await settleEdge(run, 'post', [LOG_ID, FIRST]);
    const result = await settleEdge(run, 'postBuilt', [LOG_ID, SECOND.kind, SECOND.from, SECOND.body, SECOND.memo]);
    expect(await callerFields(run)).toMatchObject({ posted: 2n, lastLength: 2n });
    expect(await readCallee(run, 'countOf', [LOG_ID])).toStrictEqual([2n]);
    expect(await readCallee(run, 'noteAt', [LOG_ID, 0n])).toStrictEqual([FIRST]);
    expect(await readCallee(run, 'noteAt', [LOG_ID, 1n])).toStrictEqual([SECOND]);
    expect((await eventsOnChain(run, run.callee, run.calleeCategoryId, result.txid)).map(({ args }) => args))
      .toStrictEqual([{ id: LOG_ID, ...SECOND }]);
  });

  it('carries a struct built at the site from a local the call also passes as its key', async () => {
    const run = await deployed();
    const key = LOG_ID + 1n;
    const result = await settleEdge(run, 'postKeyed', [LOG_ID, SECOND.from, SECOND.body, SECOND.memo]);
    expect(await callerFields(run)).toMatchObject({ posted: 1n, lastLength: 1n });
    const keyed = { ...SECOND, kind: key };
    expect(await readCallee(run, 'noteAt', [key, 0n])).toStrictEqual([keyed]);
    expect(await readCallee(run, 'countOf', [LOG_ID])).toStrictEqual([0n]);
    expect((await eventsOnChain(run, run.callee, run.calleeCategoryId, result.txid)).map(({ args }) => args))
      .toStrictEqual([{ id: key, ...keyed }]);
  });

  it('refuses a struct the callee\'s own check rejects, with its reason, and nothing is broadcast', async () => {
    const run = await deployed();
    await expectRefusedEdge(run, 'post', [LOG_ID, { ...FIRST, kind: 0n }],
      /the call's callee "Archive\.append\(\)" did not settle through the proxy: .*kind not set/);
    expect(await callerFields(run)).toMatchObject({ posted: 0n, lastLength: 0n });
  });
});

describe('known walls on the struct edge', () => {
  it('known wall: two appends to one id in one transaction are refused by the hop by name', async () => {
    const run = await deployed();
    await settleEdge(run, 'post', [LOG_ID, FIRST]);
    // Owner: the SDK hop (`proxy/external-calls.ts`, `requireSettledNodeChains`).
    await expectRefusedEdge(run, 'postTwice', [LOG_ID, SECOND, FIRST], new RegExp(
      'the hop\'s reach "Archive\\.append\\(\\)" touches a node of collection "logs" that an earlier reach '
      + '"Archive\\.append\\(\\)" writes, and its values chunk',
    ));
    expect(await readCallee(run, 'countOf', [LOG_ID])).toStrictEqual([1n]);
  });

  it('known wall: the returned value written straight to a state field never settles', async () => {
    const run = await deployed();
    // Owner: the compiler's write-segment publication (`solidc/src/per-call/master/support.ts`,
    // `perCallWriteSteps`). The two spellings write the same record after the same call; only the local's is
    // published in the segment the body writes it in.
    const { entries } = (artifacts.Desk!.composition as unknown as {
      readonly stopSites: { readonly entries: readonly PublishedEntry[] };
    }).stopSites;
    const segmentsOf = (entry: string): readonly unknown[] => entries.find((each) => each.functionName === entry)
      ?.writeSegments ?? [];
    const record = artifacts.Desk!.stateLayout!.variables.find((variable) => variable.name === 'lastLength')!.nftIndex;
    expect(segmentsOf('Desk.postDirect()')).toStrictEqual([{ record, segment: 0 }]);
    expect(segmentsOf('Desk.post()')).toContainEqual({ record, segment: 1 });
    await expectRefusedEdge(run, 'postDirect', [LOG_ID, FIRST],
      /the implementation's "postDirect" entry did not settle through the proxy in \d+ attempts/);
    expect(await callerFields(run)).toMatchObject({ posted: 0n, lastLength: 0n });
  });
});
