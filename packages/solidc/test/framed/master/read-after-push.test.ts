import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, buildEntryNftCovenantScript, buildPushdataCommitment, computeCollectionHash, encodeArgumentList,
  encodeChunkableValueTail, encodeInt, encodeIntegerValue, encodePushdataValue, encodeWitnessBlock,
  packFixedWidthArray, scriptToBytecode, sha256, validatorAddress,
  type RecordEntry, type StateValue, type WitnessBlock,
} from '@solidcash/utils';
import { stateRecordLockingBytecode } from '../../../../solidcash/src/framed/deploy/index.js';
import { keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { deployChunkRunContract, evaluateChunkRuns, type ChunkRunContract } from './chunk-run-input.js';
import {
  USER_LOCK, created, deployFramedMaster, distinctBytes, evaluateMasterSpend, head, node, spent,
  type DeployedMaster, type PlacedRecord,
} from './record-spend.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend,
} from './validator-input.js';

/**
 * A framed body that reads a verified-mapping entry after writing it, settled on the BCH-2026 machine.
 *
 * `logs` keeps one node per key, whose value is the whole `bytes4[]`. A push, a pop, a delete, an element write or a
 * whole-value write rewrites the node and closes it against the view its segment declares after the write; a read
 * of the same entry later in the body has to see the value the write left, as the EVM's does, rather than the view
 * the segment declared before the write. Each body stores what its read saw in the data record, or returns it, so
 * the record or the `retval` the frame declares carries the read's value: the honest transaction declares the EVM's
 * value and is accepted, and the same transaction declaring the value from before the write is refused.
 *
 * The data record sits at 2, ahead of the node at 3 (or the relinked head at 3 and the created node at 4); the user
 * signs at 0 and the master runs at 1. A state array, `bytes` or `string` keeps its value in a chunk run, and a read
 * after its write was already the written value: those controls stand beside the mapping shapes.
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
const STATE = ' uint public count; bytes4 public lastKind; mapping(uint => bytes4[]) logs;';

/** The bodies that push, each reading the entry after its push. */
const JOURNAL = deployFramedMaster(`${PRAGMA} contract Journal {${STATE}`
  + ' function add(uint id, bytes4 k) { this.logs[id].push(k); this.count = this.logs[id].length; }'
  + ' function addAndReturn(uint id, bytes4 k) returns (uint) { this.logs[id].push(k); return this.logs[id].length; }'
  + ' function addAndTakeLast(uint id, bytes4 k) {'
  + '   this.logs[id].push(k); uint n = this.logs[id].length; this.lastKind = this.logs[id][n - 1]; }'
  + ' }', 'read after push journal');

/** The same element read with the length read nested in its index rather than held in a local. */
const NESTED = deployFramedMaster(`${PRAGMA} contract Nested {${STATE}`
  + ' function addAndTakeNested(uint id, bytes4 k) {'
  + '   this.logs[id].push(k); this.lastKind = this.logs[id][this.logs[id].length - 1]; }'
  + ' }', 'read after push nested');

/** The bodies that pop, delete, or rewrite one element, each reading the entry after it. */
const LEDGER = deployFramedMaster(`${PRAGMA} contract Ledger {${STATE}`
  + ' function drop(uint id) { this.logs[id].pop(); this.count = this.logs[id].length; }'
  + ' function clear(uint id) { delete this.logs[id]; this.count = this.logs[id].length; }'
  + ' function put(uint id, bytes4 k) { this.logs[id][0] = k; this.lastKind = this.logs[id][0]; }'
  + ' }', 'read after push ledger');

/** A body that rewrites the whole value and reads it back, and one that reads the entry before its push. */
const REWRITE = deployFramedMaster(`${PRAGMA} contract Rewrite {${STATE}`
  + ' function replace(uint id, bytes4[] kinds) { this.logs[id] = kinds; this.lastKind = this.logs[id][0]; }'
  + ' function countThenAdd(uint id, bytes4 k) { this.count = this.logs[id].length; this.logs[id].push(k); }'
  + ' }', 'read after push rewrite');

const ID = 7n;
const SLOT = keyToSlotMulti([encodeIntegerValue(ID)]);
const ID_PUSH = encodeIntegerValue(ID);
const HELD = distinctBytes(4, 0x15);
const ADDED = distinctBytes(4, 0x3c);
const THIRD = distinctBytes(4, 0x61);
const NO_KIND = new Uint8Array(4);
const DATA_INDEX = 2;
const NODE_INDEX = 3;
const CREATED_INDEX = 4;

/** A node's value tail for the array it holds, in the shipped encoding. */
function tail(kinds: readonly Uint8Array[]): Uint8Array {
  return encodeChunkableValueTail(encodePushdataValue([...kinds], 'bytes4[]'));
}

/** The node at `ID` holding `kinds`, the end of the list. */
function nodeOf(kinds: readonly Uint8Array[]): Uint8Array {
  return node(SLOT, undefined, tail(kinds));
}

/** The data record for the given fields, in the shipped encoding. */
function record(count: bigint, lastKind: Uint8Array = NO_KIND): Uint8Array {
  const values: Record<string, StateValue> = { count, lastKind };
  return hexToBin(buildPushdataCommitment(JOURNAL.artifact.stateLayout!, values, 0));
}

/** One master's spend: the data record rewritten, then the records of the write to the node at `ID`. */
function spender(master: DeployedMaster): {
  update: (data: [Uint8Array, Uint8Array], before: readonly Uint8Array[], after: readonly Uint8Array[]) =>
  PlacedRecord[];
  insert: (data: [Uint8Array, Uint8Array], after: readonly Uint8Array[]) => PlacedRecord[];
  accepts: (entry: string, args: readonly Uint8Array[], records: PlacedRecord[], retval?: Uint8Array) => boolean;
} {
  const logs = master.collectionLock('logs');
  return {
    update: (data, before, after) => [
      spent(master.recordLock, DATA_INDEX, data[0], data[1]),
      spent(logs, NODE_INDEX, nodeOf(before), nodeOf(after)),
    ],
    insert: (data, after) => [
      spent(master.recordLock, DATA_INDEX, data[0], data[1]),
      spent(logs, NODE_INDEX, head(), head(SLOT)),
      created(logs, CREATED_INDEX, nodeOf(after)),
    ],
    accepts: (entry, args, records, retval) => evaluateMasterSpend(master, { entry, args, records, retval }).accepted,
  };
}

describe('a framed body that reads a mapping entry after writing it', () => {
  const journal = spender(JOURNAL);
  const ledger = spender(LEDGER);
  const rewrite = spender(REWRITE);
  const nested = spender(NESTED);

  it('publishes every body as a framed master within the input-script limit and with no refused entry', () => {
    for (const master of [JOURNAL, LEDGER, REWRITE, NESTED]) {
      expect(master.artifact.composition?.convention).toBe('framed');
      expect(master.artifact.composition!.refusedEntries).toBeUndefined();
      expect(master.script.length).toBeLessThanOrEqual(10_000);
    }
  });

  it('reads the length a push left: the honest record is accepted, the length from before the push refused', () => {
    const args = [ADDED, ID_PUSH];
    expect(journal.accepts('add', args, journal.update([record(0n), record(2n)], [HELD], [HELD, ADDED]))).toBe(true);
    expect(journal.accepts('add', args, journal.update([record(0n), record(1n)], [HELD], [HELD, ADDED]))).toBe(false);
  });

  it('refuses a pushed node whose value is not the one the body computed, beside the length it read', () => {
    const args = [ADDED, ID_PUSH];
    expect(journal.accepts('add', args, journal.update([record(0n), record(2n)], [HELD], [HELD, THIRD]))).toBe(false);
    expect(journal.accepts('add', args, journal.update([record(0n), record(2n)], [HELD], [HELD, ADDED]))).toBe(true);
  });

  it('reads the length a push into a key the list does not hold left', () => {
    const args = [ADDED, ID_PUSH];
    expect(journal.accepts('add', args, journal.insert([record(5n), record(1n)], [ADDED]))).toBe(true);
    expect(journal.accepts('add', args, journal.insert([record(5n), record(0n)], [ADDED]))).toBe(false);
  });

  it('returns the length a push left: the honest retval is accepted, the length from before the push refused', () => {
    const args = [ADDED, ID_PUSH];
    const records = journal.update([record(0n), record(0n)], [HELD], [HELD, ADDED]);
    const retval = (length: bigint): Uint8Array => encodeArgumentList([encodeIntegerValue(length)]);
    expect(journal.accepts('addAndReturn', args, records, retval(2n))).toBe(true);
    expect(journal.accepts('addAndReturn', args, records, retval(1n))).toBe(false);
  });

  it('reads the element a push appended at the length it left', () => {
    const args = [ADDED, ID_PUSH];
    const taken = (kind: Uint8Array): PlacedRecord[] =>
      journal.update([record(0n), record(0n, kind)], [HELD], [HELD, ADDED]);
    expect(journal.accepts('addAndTakeLast', args, taken(ADDED))).toBe(true);
    expect(journal.accepts('addAndTakeLast', args, taken(HELD))).toBe(false);
  });

  it('still reads the length from before the push for a read the body makes before it', () => {
    const args = [ADDED, ID_PUSH];
    const counted = (count: bigint): PlacedRecord[] =>
      rewrite.update([record(0n), record(count)], [HELD], [HELD, ADDED]);
    expect(rewrite.accepts('countThenAdd', args, counted(1n))).toBe(true);
    expect(rewrite.accepts('countThenAdd', args, counted(2n))).toBe(false);
  });

  it('reads the length a pop left', () => {
    const dropped = (count: bigint): PlacedRecord[] =>
      ledger.update([record(0n), record(count)], [HELD, ADDED, THIRD], [HELD, ADDED]);
    expect(ledger.accepts('drop', [ID_PUSH], dropped(2n))).toBe(true);
    expect(ledger.accepts('drop', [ID_PUSH], dropped(3n))).toBe(false);
  });

  it('reads the empty array a delete left', () => {
    const cleared = (count: bigint): PlacedRecord[] => ledger.update([record(9n), record(count)], [HELD, ADDED], []);
    expect(ledger.accepts('clear', [ID_PUSH], cleared(0n))).toBe(true);
    expect(ledger.accepts('clear', [ID_PUSH], cleared(2n))).toBe(false);
  });

  it('reads the element an element write left', () => {
    const args = [ADDED, ID_PUSH];
    const put = (kind: Uint8Array): PlacedRecord[] =>
      ledger.update([record(0n), record(0n, kind)], [HELD, THIRD], [ADDED, THIRD]);
    expect(ledger.accepts('put', args, put(ADDED))).toBe(true);
    expect(ledger.accepts('put', args, put(HELD))).toBe(false);
  });

  it('reads the element a whole-value write left', () => {
    const args = [encodePushdataValue([ADDED, THIRD], 'bytes4[]'), ID_PUSH];
    const replaced = (kind: Uint8Array): PlacedRecord[] =>
      rewrite.update([record(0n), record(0n, kind)], [HELD], [ADDED, THIRD]);
    expect(rewrite.accepts('replace', args, replaced(ADDED))).toBe(true);
    expect(rewrite.accepts('replace', args, replaced(HELD))).toBe(false);
  });

  it('reads the element a push appended through a length read nested in the element index', () => {
    // The master has one entry, so no selector leads its argument pushes.
    const taken = (kind: Uint8Array): boolean => evaluateMasterSpend(NESTED, {
      args: [ADDED, ID_PUSH], records: nested.update([record(0n), record(0n, kind)], [HELD], [HELD, ADDED]),
    }).accepted;
    expect(taken(ADDED)).toBe(true);
    expect(taken(HELD)).toBe(false);
  });
});

/**
 * The same read past a call the body makes after its write.
 *
 * The call closes the segment the push wrote in, and the next segment's own declaration of the node is the view the
 * read takes: the value the push kept serves its own segment only. The call re-enters the contract on a second
 * master, so a validator rather than the caller settles the contract and the second segment's view is whatever the
 * frames between them left; the caller's block declares the node written in the first segment and kept in the
 * second, and the machine's verdict is the caller's own input.
 */
describe('a framed body that reads a mapping entry after a call that follows its write', () => {
  const category = seededCategory('read after push across a call');
  const templateHash = sha256(REAL_VALIDATOR_PROGRAM);
  const address = validatorAddress(category, REAL_VALIDATOR_PROGRAM);
  const artifact = compileString(`${PRAGMA}`
    + ' interface IPing { function ping(); }'
    + ' contract Pinged {'
    + '   uint public count;'
    + '   mapping(uint => bytes4[]) logs;'
    + '   function add(uint id, bytes4 k) {'
    + '     this.logs[id].push(k);'
    + `     IPing(0x${binToHex(address)}).ping.call();`
    + '     this.count = this.logs[id].length;'
    + '   }'
    + '   function ping() { require(true); }'
    + ' }', { composition: 'framed' });
  const program = fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders,
    { category: categorySlotValue(category), contractAddress: address, templateHash });
  const selectorOf = (name: string): Uint8Array => hexToBin(artifact.abi.find((row) => row.name === name)!.selector!);
  const layout = artifact.stateLayout!;
  const recordOf = (count: bigint): Uint8Array => hexToBin(buildPushdataCommitment(layout, { count }, 0));
  const at = { caller: 0, user: 1, data: 2, node: 3, callee: 4, validator: 5, created: 6 };
  const satoshis = 20_000n;
  const empty: Uint8Array = new Uint8Array(0);

  type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
  type VmTransaction = NonNullable<VmProgram['transaction']>;
  type VmOutput = VmTransaction['outputs'][number];

  /**
   * The caller's verdict. `held` is the array the list holds before the push, absent for a key it does not hold,
   * whose insert relinks the head at 3 and creates the node at 6; `later` is the node the segment after the call
   * declares, and `count` the record the body writes past the call. `laterCreated` false leaves the created node out
   * of the segment after the call.
   */
  function accepts(
    held: readonly Uint8Array[] | undefined, later: readonly Uint8Array[], count: bigint, laterCreated = true,
  ): boolean {
    const validator = validatorSpend(category, { roots: [at.caller], masters: [at.caller, at.callee], settles: [] });
    const masterLock = encodeLockingBytecodeP2sh32(hash256(program));
    const dataLock = stateRecordLockingBytecode(binToHex(category));
    const nodeLock = scriptToLockingBytecode(
      buildEntryNftCovenantScript(category, computeCollectionHash(layout.collections![0]!.signature)), 'p2sh32',
    );
    const written = [...(held ?? []), ADDED];
    const [writeGroup, laterGroup]: RecordEntry[][] = held === undefined
      ? [
        [
          { in: at.node, out: at.node, viewIn: head(), viewOut: head(SLOT) },
          { in: 0xffff, out: at.created, viewIn: empty, viewOut: nodeOf(written) },
        ],
        [
          { in: at.node, out: at.node, viewIn: head(SLOT), viewOut: head(SLOT) },
          ...(laterCreated ? [{ in: 0xffff, out: at.created, viewIn: nodeOf(later), viewOut: nodeOf(later) }] : []),
        ],
      ]
      : [
        [{ in: at.node, out: at.node, viewIn: nodeOf(held), viewOut: nodeOf(written) }],
        [{ in: at.node, out: at.node, viewIn: nodeOf(later), viewOut: nodeOf(later) }],
      ];
    const segments: RecordEntry[][] = [
      [{ in: at.data, out: at.data, viewIn: recordOf(0n), viewOut: recordOf(0n) }, ...writeGroup!],
      [{ in: at.data, out: at.data, viewIn: recordOf(0n), viewOut: recordOf(count) }, ...laterGroup!],
    ];
    const ping = selectorOf('ping');
    const callerBlock: WitnessBlock = {
      kind: 0, callerRef: at.user, originRef: at.user, validatorRef: at.validator, sender: USER_LOCK,
      self: address, value: 0n, retval: empty,
      calls: [{ kind: 1, target: address, value: 0n, calleeRef: at.callee, argsHash: sha256(ping), result: empty }],
      segments, events: [], sends: [],
    };
    const calleeBlock: WitnessBlock = {
      kind: 1, callerRef: at.caller, originRef: at.user, validatorRef: at.validator, sender: address,
      self: address, value: 0n, retval: empty, calls: [], segments: [[]], events: [], sends: [],
    };
    const input = (seed: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
      outpointIndex: 0, outpointTransactionHash: distinctBytes(32, seed), sequenceNumber: 0xffffffff,
      unlockingBytecode,
    });
    const plain = encodeDataPush(new Uint8Array([1]));
    const owned = (lockingBytecode: Uint8Array, capability: 'minting' | 'mutable', commitment = empty): VmOutput =>
      ({ lockingBytecode, valueSatoshis: satoshis, token: { category, amount: 0n, nft: { capability, commitment } } });
    const inputs = [
      input(0x81, new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(callerBlock)), ...encodeDataPush(selectorOf('add')),
        ...encodeDataPush(ADDED), ...encodeDataPush(ID_PUSH), ...encodeDataPush(program),
      ])),
      input(0x82, callerUnlockingBytecode()),
      input(0x83, plain),
      input(0x84, plain),
      input(0x85, new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calleeBlock)), ...encodeDataPush(ping), ...encodeDataPush(program),
      ])),
      input(0x86, validator.unlockingBytecode),
    ];
    const outputs: VmOutput[] = [
      owned(masterLock, 'minting'),
      { lockingBytecode: USER_LOCK, valueSatoshis: 50_000n },
      owned(dataLock, 'mutable', recordOf(count)),
      owned(nodeLock, 'mutable', held === undefined ? head(SLOT) : nodeOf(later)),
      owned(masterLock, 'minting'),
      owned(validator.lock, 'mutable'),
      ...(held === undefined ? [owned(nodeLock, 'mutable', nodeOf(later))] : []),
    ];
    const sourceOutputs: VmOutput[] = [
      owned(masterLock, 'minting'),
      { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
      owned(dataLock, 'mutable', recordOf(0n)),
      owned(nodeLock, 'mutable', held === undefined ? head() : nodeOf(held)),
      owned(masterLock, 'minting'),
      owned(validator.lock, 'mutable'),
    ];
    const vm = compositionMachine();
    const state = vm.evaluate({
      inputIndex: at.caller, sourceOutputs, transaction: { version: 2, inputs, outputs, locktime: 0 },
    });
    return vm.stateSuccess(state) === true;
  }

  it('reads the length the push left from the node the segment after the call declares', () => {
    expect(accepts([HELD], [HELD, ADDED], 2n)).toBe(true);
    expect(accepts([HELD], [HELD, ADDED], 1n)).toBe(false);
  });

  it('takes the view the re-entered frame left past the call, not the value the push kept', () => {
    // The segment after the call declares the node as a write in the re-entered frame would leave it.
    expect(accepts([HELD], [HELD, ADDED, THIRD], 3n)).toBe(true);
    expect(accepts([HELD], [HELD, ADDED, THIRD], 2n)).toBe(false);
  });

  it('reads past the call the length a push into a key the list did not hold left, from the node it created', () => {
    // The proof names the relinked predecessor, which no longer brackets the key; the read names the created node
    // by the output the write segment declares for it instead.
    expect(accepts(undefined, [ADDED], 1n)).toBe(true);
    expect(accepts(undefined, [ADDED], 0n)).toBe(false);
  });

  it('takes the view the re-entered frame left on the node the push created', () => {
    expect(accepts(undefined, [ADDED, THIRD], 2n)).toBe(true);
    expect(accepts(undefined, [ADDED, THIRD], 1n)).toBe(false);
  });

  it('refuses the read when the segment after the call does not declare the node the push created', () => {
    expect(accepts(undefined, [ADDED], 1n, false)).toBe(false);
    expect(accepts(undefined, [ADDED], 0n, false)).toBe(false);
  });
});

/**
 * The controls beside it: a state `uint[]`, `bytes` and `string` keep their value in a chunk run, and a read after
 * their write in the same body was already the written value. The body requires what it read, so the honest value is
 * accepted and the value from before the write is refused.
 */
describe('a framed body that reads a chunk-run state value after writing it', () => {
  const deploy = (state: string, entry: string, label: string): ChunkRunContract =>
    deployChunkRunContract(compileString(`${PRAGMA} contract Ledger { ${state} ${entry} }`,
      { composition: 'framed' }), `read after push ${label}`);
  const values = [5n, 600n, 70_000n];
  const packed = (held: readonly bigint[]): Uint8Array => packFixedWidthArray([...held], 'uint256');
  const grow = deploy('uint[] public items;', 'function add(uint v, uint expected) { this.items.push(v);'
    + ' uint n = this.items.length; require(n == expected); require(this.items[n - 1] == v); }', 'grow');
  const shrink = deploy('uint[] public items;', 'function drop(uint expected) { this.items.pop();'
    + ' require(this.items.length == expected); require(this.items[expected - 1] == 600); }', 'shrink');
  const bytesValue = deploy('bytes public data;',
    'function add(bytes1 b, uint expected) { this.data.push(b); require(this.data.length == expected); }', 'bytes');
  const stringValue = deploy('string public name;', 'function add(string s, uint expected) {'
    + ' this.name = string.concat(this.name, s); require(bytes(this.name).length == expected); }', 'string');
  const held = distinctBytes(3, 0x21);
  const suffix = distinctBytes(2, 0x47);

  it('reads the length and the last element a push left on a state array', () => {
    const run = { variable: 'items', type: 'uint256[]', spent: packed(values.slice(0, 2)), written: packed(values) };
    const add = (expected: bigint): boolean => evaluateChunkRuns(grow, {
      args: [encodeInt(values[2]!), encodeInt(expected)], runs: [run],
    }).accepted;
    expect(add(3n)).toBe(true);
    expect(add(2n)).toBe(false);
  });

  it('reads the length and the elements a pop left on a state array', () => {
    const run = { variable: 'items', type: 'uint256[]', spent: packed(values), written: packed(values.slice(0, 2)) };
    const drop = (expected: bigint): boolean =>
      evaluateChunkRuns(shrink, { args: [encodeInt(expected)], runs: [run] }).accepted;
    expect(drop(2n)).toBe(true);
    expect(drop(3n)).toBe(false);
  });

  it('reads the length a push left on state bytes', () => {
    const run = { variable: 'data', type: 'bytes', spent: held, written: new Uint8Array([...held, 0x5a]) };
    const add = (expected: bigint): boolean => evaluateChunkRuns(bytesValue, {
      args: [new Uint8Array([0x5a]), encodeInt(expected)], runs: [run],
    }).accepted;
    expect(add(4n)).toBe(true);
    expect(add(3n)).toBe(false);
  });

  it('reads the length an append left on a state string', () => {
    const run = { variable: 'name', type: 'string', spent: held, written: new Uint8Array([...held, ...suffix]) };
    const add = (expected: bigint): boolean => evaluateChunkRuns(stringValue, {
      args: [suffix, encodeInt(expected)], runs: [run],
    }).accepted;
    expect(add(5n)).toBe(true);
    expect(add(3n)).toBe(false);
  });
});
