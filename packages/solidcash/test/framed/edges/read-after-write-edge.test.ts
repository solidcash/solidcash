import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  callerFields, edgeDeployment, expectRefusedEdge, readCallee, settleEdge,
} from './edge-harness.js';

/**
 * A body that reads a mapping entry after writing it, through the shipped cross-contract path.
 *
 * `Keeper`, `Relay` and `Widener` each sit behind their proxy and call `Journal`, deployed on its own. `Journal.log`
 * pushes onto one id's `bytes32[]` and returns the length the push left, which `Keeper.record` stores; the second
 * push makes the value long, so its node holds a head and the value lives in chunks. `Keeper.keepAt` pushes onto one
 * id's `int[]` and stores the length and the element it reads back, and `erase` deletes it and stores the length;
 * each read runs in the segment its own write closes. `Relay` and `Widener` push, call `Journal`, and read their own
 * entry past the call, where the segment the call opens declares the node; their `initialize` seeds the entry. Each
 * entry runs once per transaction through the hop, and what it stored is read back from the chain: the value the
 * EVM reads after the write.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IJournal { function log(int id, bytes32 kind) returns (int); }'
  + ' contract Journal {'
  + '   mapping(int => bytes32[]) logs;'
  + '   function log(int id, bytes32 kind) returns (int) { this.logs[id].push(kind); return this.logs[id].length; }'
  + '   function count(int id) view returns (int) { return this.logs[id].length; }'
  + ' }'
  + ' contract Keeper {'
  + '   address public implementation;'
  + '   address public journal;'
  + '   int public seen;'
  + '   int public held;'
  + '   int public last;'
  + '   mapping(int => int[]) mine;'
  + '   function initialize(address j) { this.journal = j; require(true); }'
  + '   function record(int id, bytes32 kind) { int got = IJournal(this.journal).log(id, kind); this.seen = got; }'
  + '   function keepAt(int id, int kind) {'
  + '     this.mine[id].push(kind); int n = this.mine[id].length; this.last = this.mine[id][n - 1]; this.held = n; }'
  + '   function erase(int id) { delete this.mine[id]; this.held = this.mine[id].length; }'
  + ' }'
  + ' contract Relay {'
  + '   address public implementation;'
  + '   address public journal;'
  + '   int public seen;'
  + '   int public held;'
  + '   mapping(int => uint8[]) small;'
  + '   function initialize(address j) { this.journal = j; this.small[7].push(1); }'
  + '   function keepThenLog(int id, uint8 kind, bytes32 entry) { this.small[id].push(kind);'
  + '     int got = IJournal(this.journal).log(id, entry); this.seen = got; this.held = this.small[id].length; }'
  + ' }'
  + ' contract Widener {'
  + '   address public implementation;'
  + '   address public journal;'
  + '   int public seen;'
  + '   int public held;'
  + '   mapping(int => int[]) wide;'
  + '   function initialize(address j) { this.journal = j; this.wide[7].push(1); }'
  + '   function widenThenLog(int id, int kind, bytes32 entry) { this.wide[id].push(kind);'
  + '     int got = IJournal(this.journal).log(id, entry); this.seen = got; this.held = this.wide[id].length; }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const keeper = edgeDeployment({
  scope: 'read after write edge', callee: artifacts.Journal!, caller: artifacts.Keeper!, interfaceName: 'IJournal',
});
const relay = edgeDeployment({
  scope: 'read after write across a call', callee: artifacts.Journal!, caller: artifacts.Relay!,
  interfaceName: 'IJournal',
});
const widener = edgeDeployment({
  scope: 'read after write of a long value across a call', callee: artifacts.Journal!, caller: artifacts.Widener!,
  interfaceName: 'IJournal',
});

/** The key the deployments seed. */
const ID = 7n;
/** A key no deployment holds. */
const FRESH = 8n;

/** A `bytes32` whose bytes are distinct, so no two appended words coincide. */
function word(seed: number): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, at) => (seed + at * 13) & 0xff);
}

describe('a body that reads a mapping entry after writing it', () => {
  it('reads in the callee the length its push left, inline and long, and the caller stores it', async () => {
    const run = await keeper();
    for (const [turn, seed] of [[1n, 0x11], [2n, 0x27], [3n, 0x3d]] as const) {
      const result = await settleEdge(run, 'record', [ID, word(seed)]);
      expect(result.completed.map((frame) => frame.functionName))
        .toStrictEqual(['Journal.log()', 'Keeper.record()', 'KeeperProxy.__fallback()']);
      expect(await callerFields(run)).toMatchObject({ seen: turn });
    }
    expect(await readCallee(run, 'count', [ID])).toStrictEqual([3n]);
  });

  it('reads in a proxied root the length and the element its own push left, inline and long', async () => {
    const run = await keeper();
    for (const [turn, kind] of [[1n, 31n], [2n, 32n], [3n, 33n]] as const) {
      await settleEdge(run, 'keepAt', [ID, kind]);
      expect(await callerFields(run)).toMatchObject({ held: turn, last: kind });
    }
  });

  it('reads in a proxied root the empty array its own delete left', async () => {
    const run = await keeper();
    await settleEdge(run, 'keepAt', [ID, 31n]);
    await settleEdge(run, 'keepAt', [ID, 32n]);
    expect(await callerFields(run)).toMatchObject({ held: 2n });
    await settleEdge(run, 'erase', [ID]);
    expect(await callerFields(run)).toMatchObject({ held: 0n });
  });

  it('reads past a call the length its own push left, from the node the segment after the call declares', async () => {
    const run = await relay();
    for (const turn of [1n, 2n]) {
      const result = await settleEdge(run, 'keepThenLog', [ID, 40n + turn, word(0x50 + Number(turn))]);
      expect(result.completed.map((frame) => frame.functionName))
        .toStrictEqual(['Journal.log()', 'Relay.keepThenLog()', 'RelayProxy.__fallback()']);
      expect(await callerFields(run)).toMatchObject({ seen: turn, held: turn + 1n });
    }
  });

  it('refuses a read past a call of a node its own push inserted (pinned)', async () => {
    // Pinned wall, failing closed: past the write's segment the read names the node the insert created by the output
    // the write segment declares for it (`GenerateTargetTraversal.emitCreatedTargetName`, served at master level in
    // `solidc/test/framed/master/read-after-push.test.ts`), but the hop declares no created node in a later
    // segment (`placeLaidWrites` in proxy/deploy.ts), so the read finds no record. A key the list holds settles above.
    const run = await relay();
    await expectRefusedEdge(run, 'keepThenLog', [FRESH, 41n, word(0x58)],
      /"keepThenLog" entry did not settle through the proxy: .*Program failed an OP_VERIFY operation/);
  });

  it('refuses a read past a call of a long value its own push wrote: the hop states no value for it (pinned)', async () => {
    // Pinned wall, failing closed, the same before this change: past the call the frame reads the node the segment
    // the call opens declares, and a long value's bytes come from the frame's value list, which the hop fills with
    // the value from before the transaction (`calleeValueWitnesses` in proxy/deploy.ts), so the read's root check
    // fails. An inline value past the call settles above; the same push and read with no call between settle too.
    const run = await widener();
    await expectRefusedEdge(run, 'widenThenLog', [ID, 31n, word(0x61)],
      /"widenThenLog" entry did not settle through the proxy: .*Program failed an OP_VERIFY operation/);
  });
});
