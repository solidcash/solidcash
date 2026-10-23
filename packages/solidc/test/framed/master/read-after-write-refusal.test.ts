import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import { encodeChunkableValueTail, encodeIntegerValue, encodePushdataValue } from '@solidcash/utils';
import { keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import { compileString } from '../../../src/compiler.js';
import { FramedStaleReadError } from '../../../src/Errors.js';
import {
  deployFramedMaster, distinctBytes, evaluateMasterSpend, node, spent, type DeployedMaster, type PlacedRecord,
} from './record-spend.js';

/**
 * A framed body that reads a verified-mapping entry after a write the frame does not keep, in the same segment, is
 * refused at compile time.
 *
 * A frame closes each write against the view its segment declares after the write, and a read later in the segment
 * takes the view the segment declared before it, unless the write kept its value (`read-after-push.test.ts`): the
 * body's last write to the entry, on its straight line, with keys that name one entry, in a body whose calls the
 * source fixes. Any other read of the entry before the next call, and the read a push makes of the entry it extends,
 * would see the stale view, so the compiler refuses the body and names the shape. The neighbours a frame serves still
 * compile and settle on the machine. A snapshot that only carries fields over into the entry's next write is left as
 * it was: a stale snapshot there makes the segment's two writes of the entry disagree, and the frame refuses the
 * spend rather than settle a wrong value.
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
const PING = '0x0b1c2d3e4f5061728394a5b6c7d8e9fa1b2c3d4e';
const STATE = ' uint public count; mapping(uint => bytes4[]) logs; mapping(uint => uint) totals;'
  + ' mapping(uint => mapping(uint => bytes4[])) grid;';

const readOf = (entry: string, shape: string): string => `a read of \`${entry}\` after its write ${shape} is not `
  + 'supported on the framed convention: read it before the write, or into a local';

/** The stale-read refusal a contract with `members` draws, or undefined when it compiles. */
function refusal(members: string, options: Record<string, unknown> = { composition: 'framed' }): string | undefined {
  try {
    compileString(`${PRAGMA} interface IPing { function ping(); } contract Refused {${members} }`, options);
    return undefined;
  } catch (error) {
    if (error instanceof FramedStaleReadError) return error.message;
    throw error;
  }
}

const REFUSED: readonly { readonly shape: string; readonly body: string; readonly message: string }[] = [
  {
    shape: 'a read after the branch arm that pushed',
    body: ' function f(uint id, bytes4 k, bool b) { if (b) { this.logs[id].push(k); }'
      + ' this.count = this.logs[id].length; }',
    message: readOf('logs[id]', 'in a branch arm'),
  },
  {
    shape: 'a read in the arm that pushed',
    body: ' function f(uint id, bytes4 k, bool b) { if (b) { this.logs[id].push(k);'
      + ' this.count = this.logs[id].length; } }',
    message: readOf('logs[id]', 'in a branch arm'),
  },
  {
    shape: 'a read in the code an early return nests',
    body: ' function f(uint id, bytes4 k) { if (id == 0) { return; } this.logs[id].push(k);'
      + ' this.count = this.logs[id].length; }',
    message: readOf('logs[id]', 'in the code after an early return'),
  },
  {
    shape: 'a read after a write in a loop',
    body: ' function f(uint[] ks, uint v) { for (uint i = 0; i < ks.length; i++) {'
      + ' this.totals[ks[i]] = v; require(this.totals[ks[i]] == v); } }',
    message: readOf('totals[ks[i]]', 'in a loop'),
  },
  {
    shape: 'a read of an entry an expression keys',
    body: ' function f(uint id, bytes4 k) { this.logs[id + 1].push(k); this.count = this.logs[id + 1].length; }',
    message: readOf('logs[id + 1]', 'with an expression key'),
  },
  {
    shape: 'a read of an entry a reassigned name keys',
    body: ' function f(uint id, bytes4 k) { id = id + 1; this.logs[id].push(k); this.count = this.logs[id].length; }',
    message: readOf('logs[id]', 'with a reassigned key'),
  },
  {
    shape: 'a read in a body whose calls vary on paths',
    body: ` function f(uint id, bytes4 k, bool b) { this.logs[id].push(k); if (b) { IPing(${PING}).ping.call(); }`
      + ' this.count = this.logs[id].length; }',
    message: readOf('logs[id]', 'in a body whose calls vary on paths'),
  },
  {
    shape: 'a helper\'s push after the same helper pushed',
    body: ' function _push(uint id, bytes4 k) internal { this.logs[id].push(k); }'
      + ' function f(uint id, bytes4 k) { _push(id, k); _push(id, k); }',
    message: readOf('logs[id]', 'when the body writes it again'),
  },
  {
    shape: 'a push after a whole write of the entry',
    body: ' function f(uint a, uint b, bytes4 k, bytes4[] kinds) { this.grid[a][b] = kinds; this.grid[a][b].push(k); }',
    message: 'a push on `grid[a][b]` after its write when the body writes it again is not supported on the framed '
      + 'convention: update a local and write the entry once',
  },
  {
    shape: 'a read nested in an element index after the branch arm that pushed',
    body: ' function f(uint id, bytes4 k, bool b) { if (b) { this.logs[id].push(k); }'
      + ' require(this.logs[id][this.logs[id].length - 1] == k); }',
    message: readOf('logs[id]', 'in a branch arm'),
  },
];

const ARB = ' struct Arb { uint fee; uint buyer; uint seller; } uint public count; mapping(uint => Arb) arbs;';

describe('a framed read of a mapping entry after a write the frame does not keep', () => {
  for (const { shape, body, message } of REFUSED) {
    it(`refuses ${shape}, naming the entry and the shape`, () => {
      expect(refusal(`${STATE}${body}`)).toContain(message);
    });
  }

  it('refuses a snapshot after an arm\'s write that does more than carry fields into the entry\'s next write', () => {
    expect(refusal(`${ARB} function f(uint id, bool b) {`
      + ' if (b) { Arb memory x = arbs[id]; arbs[id] = Arb(x.fee, 1, x.seller); }'
      + ' Arb memory y = arbs[id]; this.count = y.buyer; }')).toContain(readOf('arbs[id]', 'in a branch arm'));
  });

  it('refuses the same bodies on the direct convention, whose read would take the entry the transaction spends', () => {
    for (const { body, message } of REFUSED.slice(0, 3)) {
      expect(() => refusal(`${STATE}${body}`, {}))
        .toThrow(message.replace('the framed convention', 'the direct convention'));
    }
  });

  it('compiles a read past a call that every path makes, which the next segment\'s declaration serves', () => {
    // The machine's verdict on a read past a call is in `read-after-push.test.ts`, whose caller re-enters the master.
    expect(refusal(`${STATE} function f(uint id, bytes4 k, bool b) { this.logs[id].push(k);`
      + ` if (b) { IPing(${PING}).ping.call(); } else { IPing(${PING}).ping.call(); }`
      + ' this.count = this.logs[id].length; }')).toBeUndefined();
  });
});

const NEIGHBOURS = deployFramedMaster(`${PRAGMA} contract Neighbours {${STATE}`
  + ' function readThenArm(uint id, bytes4 k, bool b) { this.count = this.logs[id].length;'
  + '   if (b) { this.logs[id].push(k); } }'
  + ' function pushThenRead(uint id, bytes4 k) { this.logs[id].push(k); this.count = this.logs[id].length; }'
  + ' function pushOrRead(uint id, bytes4 k, bool b) {'
  + '   if (b) { this.logs[id].push(k); } else { this.count = this.logs[id].length; } }'
  + ' function pushTwice(uint id, bytes4 k) { this.logs[id].push(k); this.logs[id].push(k); }'
  + ' }', 'stale read refusal neighbours');

const ID = encodeIntegerValue(7n);
const SLOT = keyToSlotMulti([ID]);
const HELD = distinctBytes(4, 0x15);
const ADDED = distinctBytes(4, 0x3c);
const YES = encodeIntegerValue(1n);
const NO = encodeIntegerValue(0n);

/** The data record carrying `count`, rewritten from `before`, and the node at `ID` holding `held`, then `kinds`. */
function logsSpend(before: bigint, count: bigint, held: readonly Uint8Array[], kinds: readonly Uint8Array[]):
PlacedRecord[] {
  const tail = (values: readonly Uint8Array[]): Uint8Array =>
    encodeChunkableValueTail(encodePushdataValue([...values], 'bytes4[]'));
  return [
    spent(NEIGHBOURS.recordLock, 2, NEIGHBOURS.record({ count: before }), NEIGHBOURS.record({ count })),
    spent(NEIGHBOURS.collectionLock('logs'), 3, node(SLOT, undefined, tail(held)), node(SLOT, undefined, tail(kinds))),
  ];
}

const accepts = (master: DeployedMaster, entry: string, args: Uint8Array[], records: PlacedRecord[]): boolean =>
  evaluateMasterSpend(master, { entry, args, records }).accepted;

describe('the neighbours a framed frame serves beside the refused reads', () => {
  it('reads the entry before an arm\'s push: the length from before the push is the honest one', () => {
    const args = [YES, ADDED, ID];
    expect(accepts(NEIGHBOURS, 'readThenArm', args, logsSpend(0n, 1n, [HELD], [HELD, ADDED]))).toBe(true);
    expect(accepts(NEIGHBOURS, 'readThenArm', args, logsSpend(0n, 2n, [HELD], [HELD, ADDED]))).toBe(false);
  });

  it('reads back a top-level push from the value it kept', () => {
    const args = [ADDED, ID];
    expect(accepts(NEIGHBOURS, 'pushThenRead', args, logsSpend(0n, 2n, [HELD], [HELD, ADDED]))).toBe(true);
    expect(accepts(NEIGHBOURS, 'pushThenRead', args, logsSpend(0n, 1n, [HELD], [HELD, ADDED]))).toBe(false);
  });

  it('reads the entry in the arm the push is not in', () => {
    expect(accepts(NEIGHBOURS, 'pushOrRead', [NO, ADDED, ID], logsSpend(0n, 1n, [HELD], [HELD]))).toBe(true);
    expect(accepts(NEIGHBOURS, 'pushOrRead', [NO, ADDED, ID], logsSpend(0n, 0n, [HELD], [HELD]))).toBe(false);
    expect(accepts(NEIGHBOURS, 'pushOrRead', [YES, ADDED, ID], logsSpend(0n, 0n, [HELD], [HELD, ADDED]))).toBe(true);
  });

  it('settles two pushes of one entry, which the entry cache writes once', () => {
    const args = [ADDED, ID];
    expect(accepts(NEIGHBOURS, 'pushTwice', args, logsSpend(0n, 0n, [HELD], [HELD, ADDED, ADDED]))).toBe(true);
    expect(accepts(NEIGHBOURS, 'pushTwice', args, logsSpend(0n, 0n, [HELD], [HELD, ADDED]))).toBe(false);
  });
});

const SNAPSHOTS = deployFramedMaster(`${PRAGMA} contract Snapshots {${ARB}`
  + ' function approve(uint id, bool b, bool s) {'
  + '   if (b) { Arb memory x = arbs[id]; arbs[id] = Arb(x.fee, 1, x.seller); }'
  + '   if (s) { Arb memory y = arbs[id]; arbs[id] = Arb(y.fee, y.buyer, 1); } }'
  + ' function propose(uint id, uint fee, bool b) {'
  + '   Arb memory x = arbs[id]; arbs[id] = Arb(fee, x.buyer, x.seller);'
  + '   if (b) { Arb memory y = arbs[id]; arbs[id] = Arb(y.fee, 1, 0); } }'
  + ' }', 'stale read refusal snapshots');

/** A small struct value's node tail: the 4-byte little-endian length, then each field as a minimal push. */
function arbOf(fields: readonly bigint[]): Uint8Array {
  const blob = new Uint8Array(fields.flatMap((field) => [...encodeDataPush(encodeIntegerValue(field))]));
  return node(SLOT, undefined, new Uint8Array([blob.length & 0xff, (blob.length >> 8) & 0xff, 0, 0, ...blob]));
}

/** The kept data record, then the node at `ID` rewritten from `{5, 0, 0}` to `after`. */
function arbSpend(after: readonly bigint[]): PlacedRecord[] {
  return [
    spent(SNAPSHOTS.recordLock, 2, SNAPSHOTS.record({ count: 0n })),
    spent(SNAPSHOTS.collectionLock('arbs'), 3, arbOf([5n, 0n, 0n]), arbOf(after)),
  ];
}

describe('a snapshot that only carries fields over into the entry\'s next write', () => {
  it('compiles, and settles each arm that writes the entry alone', () => {
    expect(accepts(SNAPSHOTS, 'approve', [NO, YES, ID], arbSpend([5n, 1n, 0n]))).toBe(true);
    expect(accepts(SNAPSHOTS, 'approve', [YES, NO, ID], arbSpend([5n, 0n, 1n]))).toBe(true);
    expect(accepts(SNAPSHOTS, 'propose', [NO, encodeIntegerValue(9n), ID], arbSpend([9n, 0n, 0n]))).toBe(true);
  });

  it('known wall: fails closed where a second write of the entry follows the first in the segment', () => {
    // Pinned wall, failing closed and unchanged: the second snapshot takes the view the segment declared, not the
    // first write (`GenerateTargetTraversal.emitSortedSetRead` keeps no value for a write the body writes again or
    // writes in an arm), so the two writes disagree and no node satisfies both. The message-bus kernel lowering
    // (`CoalesceMappingEntryFieldWrites(true)`) spells every single field write this way.
    for (const after of [[5n, 1n, 1n], [5n, 0n, 1n], [5n, 1n, 0n]]) {
      expect(accepts(SNAPSHOTS, 'approve', [YES, YES, ID], arbSpend(after))).toBe(false);
    }
    for (const after of [[9n, 1n, 0n], [9n, 0n, 0n], [5n, 1n, 0n]]) {
      expect(accepts(SNAPSHOTS, 'propose', [YES, encodeIntegerValue(9n), ID], arbSpend(after))).toBe(false);
    }
  });
});
