import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildEntryNftCovenantScript, computeCollectionHash, encodePushdataValue, encodeWitnessBlock,
  scriptToBytecode, sha256, validatorAddress,
  type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/per-call/master/placeholders.js';
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend } from './validator-input.js';

/**
 * Which witness segment declares the records of a run-time-loop mapping upsert, asked of the shipped machine.
 *
 * The entry upserts a mapping in a loop whose trip count the execution decides, and makes one external call beside
 * the loop rather than inside it. The compiler serves the body, the per-call block layout declares the collection's
 * own `entry` slot and the artifact publishes the in-loop access beside it, and no write-segment fact is published:
 * the write follows a loop whose trip count the execution decides, so no one segment the run opens is the answer.
 * This suite puts the question to the machine: the same compiled master is asked for a verdict
 * with the mapping's node record declared in the segment the entry's own call count names (before the call) and
 * again with it in the last segment the run opens.
 *
 * The controls fix the harness: the same head with the loop removed is accepted, and the head's non-loop
 * counterpart - one mapping write beside the same call, which the per-call batch path does serve - is accepted with
 * its record in the segment the write lands in and refused with it in the last segment, so the segment the machine
 * reads for a mapping record is decided by the machine and not assumed here.
 *
 * The runtime-loop upsert whose *key the frame holds* is a different shape, and the machine accepts it: its
 * well-formed spend is settled, with the record it wrote changed refused beside it, on the shipped path in
 * `solidcash/test/per-call/conformance/loop-upsert-settlement.test.ts` (`:93-96`, `:110-121`). This file's verdicts
 * are about the varying key: the frame the shipped call path plans declares no record for its collection, which the
 * machine reads as the no-record sentinel, and a declaration the frame does carry puts the turn's coordinate on
 * another participant's UTXO.
 */

const CATEGORY_LEDGER = seededCategory('loop upsert segment ledger');
const CATEGORY_OTHER = seededCategory('loop upsert segment other');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_LEDGER = validatorAddress(CATEGORY_LEDGER, VALIDATOR_PROGRAM);
const ADDRESS_OTHER = validatorAddress(CATEGORY_OTHER, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const EMPTY = new Uint8Array(0);
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/** The external call every body makes beside its loop: `IOther(<address>).ping()`. */
const CALL = `IOther(0x${toHex(ADDRESS_OTHER)}).ping.call(); require(true);`;
const OTHER = ' interface IOther { function ping(); } contract Other { function ping() { require(true); } }';

/** The entry under test: a run-time loop upserts a mapping, and one call sits beside the loop, after it. */
const LOOP_SOURCE = `pragma solidcash ^0.13.0;${OTHER}`
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address[] workers, uint amount) {'
  + '     for (int i = 0; i < workers.length; i = i + 1) { balances[workers[i]] = amount; }'
  + `     ${CALL}`
  + '   }'
  + ' }';

/** The control: the same head and call with the loop removed, so no record is declared for a mapping. */
const PLAIN_SOURCE = `pragma solidcash ^0.13.0;${OTHER}`
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + `   function move(address[] workers, uint amount) { ${CALL} }`
  + ' }';

/**
 * The shape the fixture's own entry has: the loop body both upserts the mapping and makes its call, so one turn
 * writes and calls before the next turn writes again.
 *
 * This is the shape the handoff names for the entry whose writes the artifact states for no segment: the mapping is
 * not a verified batch here (the block layout reserves no entry slot for it), and the upsert is carried by the
 * run-time-loop machinery instead. The case below pins what the shipped compiler and the shipped machine do with
 * it, so the shape's wall is a recorded reproducer rather than a claim.
 */
const LOOP_CALL_INSIDE_SOURCE = `pragma solidcash ^0.13.0;${OTHER}
 contract Ledger {
   mapping(address => uint) balances;
   function move(address[] workers, uint amount) {
     for (int i = 0; i < workers.length; i = i + 1) {
       balances[workers[i]] = amount;
       ${CALL}
     }
   }
 }`;

/** The control: the head's non-loop counterpart, one mapping write beside the same call. */
const BATCH_SOURCE = `pragma solidcash ^0.13.0;${OTHER}`
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address to, uint amount) {'
  + '     balances[to] = amount;'
  + `     ${CALL}`
  + '   }'
  + ' }';

const insideArtifacts = compileStringMulti(LOOP_CALL_INSIDE_SOURCE, { composition: 'per-call' });
const loopArtifacts = compileStringMulti(LOOP_SOURCE, { composition: 'per-call' });
const plainArtifacts = compileStringMulti(PLAIN_SOURCE, { composition: 'per-call' });
const batchArtifacts = compileStringMulti(BATCH_SOURCE, { composition: 'per-call' });
const ledger = loopArtifacts.Ledger!;
const PING_SELECTOR = new Uint8Array(Buffer.from(
  loopArtifacts.Other!.abi.find((entry) => entry.name === 'ping')!.selector!, 'hex',
));

function fill(artifact: { readonly bytecode: string; readonly composition?: unknown }, category: Uint8Array,
  address: Uint8Array): Uint8Array {
  const composition = artifact.composition as { readonly placeholders: unknown };
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), composition.placeholders, {
    category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
  });
}

const insideProgram = fill(insideArtifacts.Ledger!, CATEGORY_LEDGER, ADDRESS_LEDGER);
const insideLock = encodeLockingBytecodeP2sh32(hash256(insideProgram));
const loopProgram = fill(ledger, CATEGORY_LEDGER, ADDRESS_LEDGER);
const plainProgram = fill(plainArtifacts.Ledger!, CATEGORY_LEDGER, ADDRESS_LEDGER);
const batchProgram = fill(batchArtifacts.Ledger!, CATEGORY_LEDGER, ADDRESS_LEDGER);
const otherProgram = fill(loopArtifacts.Other!, CATEGORY_OTHER, ADDRESS_OTHER);
const loopLock = encodeLockingBytecodeP2sh32(hash256(loopProgram));
const plainLock = encodeLockingBytecodeP2sh32(hash256(plainProgram));
const batchLock = encodeLockingBytecodeP2sh32(hash256(batchProgram));
const otherLock = encodeLockingBytecodeP2sh32(hash256(otherProgram));

/** The collection's entry covenant, which every mapping node output is locked to. */
const entryLock = scriptToLockingBytecode(buildEntryNftCovenantScript(CATEGORY_LEDGER,
  computeCollectionHash(ledger.stateLayout!.collections![0]!.signature)), 'p2sh32');

/** The one key the loop writes, and the node it starts from and must leave. */
const WORKER = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
const AMOUNT = 42n;
const VALUE_TAIL = new Uint8Array([Number(AMOUNT)]);
const WORKERS = encodePushdataValue([WORKER], 'address[]');
const SLOT = keyToSlot(WORKER);
const ZERO_SLOT = new Uint8Array(32);
const NODE_BEFORE = encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([7]));
const NODE_AFTER = encodeEntryCommitment(SLOT, ZERO_SLOT, VALUE_TAIL);

/** Master input indices: the ledger, the mapping node, the callee, the validator, then the user. */
const LEDGER_INDEX = 0;
const NODE_INDEX = 1;
const OTHER_INDEX = 2;
const VALIDATOR_INDEX = 3;
const USER_INDEX = 4;

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

function token(category: Uint8Array, capability: 'minting' | 'mutable', commitment = EMPTY): VmOutput['token'] {
  return { category, amount: 0n, nft: { capability, commitment } };
}

interface Built {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmProgram['sourceOutputs'];
}

/**
 * Frames an entry whose call sits beside a loop, with the mapping node's record declared in `segment`.
 *
 * `records` is the node declaration the frame carries; `segment` is the segment its own list holds it in. The
 * loop-shaped and batch-shaped bodies share every other fact - the same call, the same callee, the same validator,
 * the same node at the same index - so the only variable between them is the body that runs.
 */
function build(program: Uint8Array, lock: Uint8Array, workerOrKey: Uint8Array, records: RecordEntry[],
  segment: 0 | 1, plainCoin = false): Built {
  const segments: RecordEntry[][] = [[], []];
  segments[segment] = records;
  const ledgerBlock: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_LEDGER,
    value: 0n,
    retval: EMPTY,
    calls: [{
      kind: 1, target: ADDRESS_OTHER, value: 0n, calleeRef: OTHER_INDEX,
      argsHash: sha256(PING_SELECTOR), result: EMPTY,
    }],
    segments,
    events: [],
    sends: [],
  };
  const otherBlock: WitnessBlock = {
    kind: 1,
    callerRef: LEDGER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: ADDRESS_LEDGER,
    self: ADDRESS_OTHER,
    value: 0n,
    retval: EMPTY,
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const validator = validatorSpend(CATEGORY_LEDGER, {
    roots: [LEDGER_INDEX], masters: [LEDGER_INDEX, OTHER_INDEX], settles: [],
  });

  const inputs: VmTransaction['inputs'] = [];
  inputs[LEDGER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
    // Arguments are pushed deepest parameter first, so the array sits on top where the body reads it.
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(ledgerBlock)),
      ...encodeDataPush(VALUE_TAIL),
      ...encodeDataPush(workerOrKey),
      ...encodeDataPush(program),
    ]),
  };
  inputs[NODE_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };
  inputs[OTHER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(3), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(otherBlock)),
      ...encodeDataPush(PING_SELECTOR),
      ...encodeDataPush(otherProgram),
    ]),
  };
  inputs[VALIDATOR_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(4), sequenceNumber: 0xffffffff,
    unlockingBytecode: validator.unlockingBytecode,
  };
  inputs[USER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(5), sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };

  const outputs: VmOutput[] = [];
  outputs[LEDGER_INDEX] = { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(CATEGORY_LEDGER, 'minting') };
  outputs[NODE_INDEX] = plainCoin
    ? { lockingBytecode: USER_LOCK, valueSatoshis: 20_000n }
    : { lockingBytecode: entryLock, valueSatoshis: 20_000n,
      token: token(CATEGORY_LEDGER, 'mutable', NODE_AFTER) };
  outputs[OTHER_INDEX] = { lockingBytecode: otherLock, valueSatoshis: 20_000n,
    token: token(CATEGORY_OTHER, 'minting') };
  outputs[VALIDATOR_INDEX] = { lockingBytecode: validator.lock, valueSatoshis: 20_000n,
    token: token(CATEGORY_LEDGER, 'mutable') };
  outputs[USER_INDEX] = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };

  const sourceOutputs: VmProgram['sourceOutputs'] = [];
  sourceOutputs[LEDGER_INDEX] = { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(CATEGORY_LEDGER, 'minting') };
  sourceOutputs[NODE_INDEX] = plainCoin
    ? { lockingBytecode: USER_LOCK, valueSatoshis: 20_000n }
    : { lockingBytecode: entryLock, valueSatoshis: 20_000n,
      token: token(CATEGORY_LEDGER, 'mutable', NODE_BEFORE) };
  sourceOutputs[OTHER_INDEX] = { lockingBytecode: otherLock, valueSatoshis: 20_000n,
    token: token(CATEGORY_OTHER, 'minting') };
  sourceOutputs[VALIDATOR_INDEX] = { lockingBytecode: validator.lock, valueSatoshis: 20_000n,
    token: token(CATEGORY_LEDGER, 'mutable') };
  sourceOutputs[USER_INDEX] = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };

  return { transaction: { version: 2, inputs, outputs, locktime: 0 }, sourceOutputs };
}

/** The one node declaration the entry's write carries: the target rewritten in place. */
const NODE_RECORD: RecordEntry = { in: NODE_INDEX, out: NODE_INDEX, viewIn: NODE_BEFORE, viewOut: NODE_AFTER };

/** The ledger input's verdict in the BCH-2026 machine, with the objection for a diagnosis. */
function verdict(built: Built): { accepted: boolean; objection?: string } {
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: LEDGER_INDEX, sourceOutputs: built.sourceOutputs, transaction: built.transaction,
  });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

/** The segment the entry's own call count names: one call precedes the tail, so the write's records land in 0. */
const WRITE_SEGMENT = 0;
/** The last segment the run opens, one past the call. */
const LAST_SEGMENT = 1;

describe('a per-call master whose entry upserts a mapping in a run-time loop beside a call', () => {
  it('serves the body, declares the collection its entry slot and publishes the access, with the segment unstated', () => {
    expect(ledger.composition?.convention).toBe('per-call');
    expect(ledger.composition?.refusedEntries).toBeUndefined();
    const entry = ledger.composition!.stopSites.entries.find(
      (candidate) => candidate.functionName === 'Ledger.move()',
    )!;
    // No write fact is published for the upsert today, so a builder has no segment to declare its records in.
    expect(entry.writeSegment).toBeUndefined();
    expect(entry.writeSegments).toBeUndefined();
    // The per-call layout declares the collection's own slot, which the frame's per-turn nodes are placed from, and
    // the artifact publishes the in-loop access beside it - the coordinate the SDK's per-turn planning reads. The
    // direct convention keeps this access out of the fixed slots and carries it in the trailing band instead.
    const move = ledger.abi.find((candidate) => candidate.name === 'move')!;
    expect(move.blockLayout).toStrictEqual({
      blockSize: 2,
      slots: [{ kind: 'master', offset: 0 }, { kind: 'entry', offset: 1, slotIndex: 0, conditional: true }],
    });
    expect(move.entryAccesses?.map((access) => ({
      slotIndex: access.slotIndex, collection: access.collection,
      keyParams: access.keyParams, operations: access.operations,
    }))).toStrictEqual([{
      slotIndex: 0, collection: 'balances', keyParams: ['arridx(id:workers,id:i)'], operations: ['write'],
    }]);
  });

  it('accepts the same head with the loop removed, so the frame itself is sound', () => {
    const outcome = verdict(build(plainProgram, plainLock, WORKERS, [], WRITE_SEGMENT, true));
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('refuses the run-time-loop upsert with its records in the segment before the call', () => {
    // The frame's own base is the index of the record its block declares first, so a node declared in the segment
    // before the call puts the loop's per-turn coordinate on another participant and the body fails its comparison.
    const outcome = verdict(build(loopProgram, loopLock, WORKERS, [NODE_RECORD], WRITE_SEGMENT));
    expect({ accepted: outcome.accepted, objection: outcome.objection }).toStrictEqual({
      accepted: false, objection: 'Program failed an OP_VERIFY operation.',
    });
  });

  it('refuses the run-time-loop upsert with its records in the last segment the run opens', () => {
    // A segment whose list holds no record leaves the sentinel, which no index opcode accepts: the read the body
    // makes for its turn names no UTXO at all rather than another participant's.
    const outcome = verdict(build(loopProgram, loopLock, WORKERS, [NODE_RECORD], LAST_SEGMENT));
    expect({ accepted: outcome.accepted, objection: outcome.objection }).toStrictEqual({
      accepted: false,
      objection: 'Program attempted to read from an invalid transaction UTXO index. Transaction UTXO count: 5; '
        + 'requested index: -32767.',
    });
  });
});

/**
 * The head's non-loop counterpart, as the machine's own control for the segment a mapping record belongs in.
 *
 * The write is not in a loop, so the per-call batch path derives its operands from the segment the write lands in.
 * The machine accepts the declaration there and refuses the same declaration one segment later, which is what fixes
 * the segment the machine reads for a mapping node record rather than leaving it to this suite.
 */
describe('the fixture\'s own shape: the loop body both upserts the mapping and makes the call', () => {
  it('serves the body, declares the collection its entry slot, and still states no segment for its records', () => {
    expect(insideArtifacts.Ledger!.composition?.refusedEntries).toBeUndefined();
    const entry = insideArtifacts.Ledger!.composition!.stopSites.entries.find(
      (candidate) => candidate.functionName === 'Ledger.move()',
    )!;
    // A varying key is not one write the walk places, so no segment states where its records are declared: the
    // entry publishes nothing rather than a guessed segment. The collection's slot is declared all the same, which
    // is the coordinate a per-call frame's per-turn nodes are placed from.
    expect(entry.writeSegment).toBeUndefined();
    expect(entry.writeSegments).toBeUndefined();
    expect(insideArtifacts.Ledger!.abi.find((candidate) => candidate.name === 'move')!.blockLayout)
      .toStrictEqual({
        blockSize: 2,
        slots: [{ kind: 'master', offset: 0 }, { kind: 'entry', offset: 1, slotIndex: 0, conditional: true }],
      });
  });

  it('refuses the well-formed spend wherever the node record is declared', () => {
    // The same head with the loop removed is accepted above, and the same head with a parameter key settles under
    // the machine's own segment control below. The frame's base is the record its block declares first, so the
    // segment the declaration sits in decides what the loop's per-turn coordinate lands on: the record declared in
    // the segment the loop runs in makes that coordinate name another participant's UTXO (the body fails its
    // comparison), and a segment whose list holds no record leaves the sentinel, which no index opcode accepts.
    const objections = ([0, 1] as const).map((segment) => ({
      segment, ...verdict(build(insideProgram, insideLock, WORKERS, [NODE_RECORD], segment)),
    }));
    expect(objections).toStrictEqual([
      { segment: 0, accepted: false, objection: 'Program failed an OP_VERIFY operation.' },
      {
        segment: 1, accepted: false,
        objection: 'Program attempted to read from an invalid transaction UTXO index. Transaction UTXO count: 5; '
          + 'requested index: -32767.',
      },
    ]);
  });
});

describe('the same head with one mapping write beside the same call, the machine\'s segment control', () => {
  it('accepts the write whose record is declared in the segment the write lands in', () => {
    const outcome = verdict(build(batchProgram, batchLock, WORKER, [NODE_RECORD], WRITE_SEGMENT));
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('refuses the same declaration one segment later', () => {
    const outcome = verdict(build(batchProgram, batchLock, WORKER, [NODE_RECORD], LAST_SEGMENT));
    expect(outcome.accepted).toBe(false);
  });
});
