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
 * Former walls, each settled now:
 * - Two appends to one id in one transaction (the job-event edge's loop). The second reach is planned from the value
 *   the first left, and its declaration of the node continues from the first's view (`proxy/external-calls.ts`,
 *   `rewrittenNodes`).
 * - The returned value written straight to a state field (`this.lastLength = IArchive(this.archive).append(id, n)`,
 *   the market's `job.escrowId = unicrow.pay(...)`). The write's own right-hand side makes the call, and the store
 *   is emitted after it returns, so the compiler publishes that write in the segment the call opened (the same
 *   segment the spelling through a local names), and the entry settles.
 */

// `append` reads the length before its push: read after it in the same body, a framed master answers the length
// the array had before the push (reported beside this replica; not an edge shape).
const SOURCE = 'pragma solidcash ^0.14.0;'
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

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const deployed = edgeDeployment({
  scope: 'struct argument edge', callee: artifacts.Archive!, caller: artifacts.Desk!, interfaceName: 'IArchive',
});

const LOG_ID = 7n;
const FIRST = { kind: 2n, from: hexToBin('a1b2c3d4'), body: hexToBin('0102030405'), memo: 'first note' };
const SECOND = { kind: 5n, from: hexToBin('0e0f'), body: hexToBin('6a6b6c6d6e6f'), memo: 'second note' };

describe('a struct argument with two bytes members and a string', () => {
  it('reaches the callee whole, is appended and emitted, and the length it returns reaches the caller; a struct '
    + 'the caller builds from its own arguments is appended after it', async () => {
    const run = await deployed();
    const first = await settleEdge(run, 'post', [LOG_ID, FIRST]);
    expect(first.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Archive.append()', 'Desk.post()', 'DeskProxy.__fallback()']);
    expect(await callerFields(run)).toMatchObject({ posted: 1n, lastLength: 1n });
    expect(await readCallee(run, 'countOf', [LOG_ID])).toStrictEqual([1n]);
    expect(await readCallee(run, 'noteAt', [LOG_ID, 0n])).toStrictEqual([FIRST]);
    expect((await eventsOnChain(run, run.callee, run.calleeCategoryId, first.txid))
      .map(({ name, args }) => ({ name, args }))).toStrictEqual([
      { name: 'Appended', args: { id: LOG_ID, ...FIRST } },
    ]);

    const built = await settleEdge(run, 'postBuilt', [LOG_ID, SECOND.kind, SECOND.from, SECOND.body, SECOND.memo]);
    expect(await callerFields(run)).toMatchObject({ posted: 2n, lastLength: 2n });
    expect(await readCallee(run, 'countOf', [LOG_ID])).toStrictEqual([2n]);
    expect(await readCallee(run, 'noteAt', [LOG_ID, 0n])).toStrictEqual([FIRST]);
    expect(await readCallee(run, 'noteAt', [LOG_ID, 1n])).toStrictEqual([SECOND]);
    expect((await eventsOnChain(run, run.callee, run.calleeCategoryId, built.txid)).map(({ args }) => args))
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

describe('the struct edge\'s former walls', () => {
  it('settles two appends to one id in one transaction, the second continuing from the value the first left',
    async () => {
      const run = await deployed();
      await settleEdge(run, 'post', [LOG_ID, FIRST]);
      // Each append reads the length before its push, so the first returns 2 and the second 3: the second reach is
      // planned from the value the first left, which also sizes the run of chunk records its own version takes.
      const twice = await settleEdge(run, 'postTwice', [LOG_ID, SECOND, FIRST]);
      expect(await callerFields(run)).toMatchObject({ posted: 3n, lastLength: 3n });
      expect(await readCallee(run, 'countOf', [LOG_ID])).toStrictEqual([3n]);
      expect(await readCallee(run, 'noteAt', [LOG_ID, 1n])).toStrictEqual([SECOND]);
      expect(await readCallee(run, 'noteAt', [LOG_ID, 2n])).toStrictEqual([FIRST]);
      expect((await eventsOnChain(run, run.callee, run.calleeCategoryId, twice.txid)).map(({ args }) => args))
        .toStrictEqual([{ id: LOG_ID, ...SECOND }, { id: LOG_ID, ...FIRST }]);
    });

  it('settles the returned value written straight to a state field, as its own record write', async () => {
    const run = await deployed();
    // The two spellings write the same record after the same call, so both are published in the segment the body
    // writes them in: the call the store's own right-hand side makes closes the segment the store lands past.
    const { entries } = artifacts.Desk!.composition!.stopSites!;
    const segmentsOf = (entry: string): readonly unknown[] => entries.find((each) => each.functionName === entry)
      ?.writeSegments ?? [];
    const record = artifacts.Desk!.stateLayout!.variables.find((variable) => variable.name === 'lastLength')!.nftIndex;
    expect(segmentsOf('Desk.postDirect()')).toStrictEqual([{ record, segment: 1, writtenVariables: ['lastLength'] }]);
    expect(segmentsOf('Desk.post()')).toContainEqual({ record, segment: 1, writtenVariables: ['lastLength'] });

    const result = await settleEdge(run, 'postDirect', [LOG_ID, FIRST]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The record the transaction carries is the value the callee's own return supplied.
    expect(await callerFields(run)).toMatchObject({ posted: 0n, lastLength: 1n });
  });
});
