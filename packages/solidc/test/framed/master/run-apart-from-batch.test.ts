import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
  hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, buildChunkCommitment, buildEntryNftCovenantScript, buildPushdataCommitment, computeCollectionHash,
  computeFunctionSelector, computeFunctionSignature, dynamicChunkSignature, encodeWitnessBlock, scriptToBytecode,
  sha256, validatorAddress, type Artifact, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory, validatorSpend,
} from './validator-input.js';

/**
 * A framed master whose verified-mapping batch and dynamic run land in different segments.
 *
 * The entry inserts a mapping node, makes a call and then writes a `string`: the call closes the segment the batch's
 * records are declared in, and the run the write grows is pinned in the segment the call opened. The frame reads
 * that run in its own segment, past the records every segment declares ahead of any group, and holds the segment to
 * the run alone. The whole shipped path runs: the source through `compileStringMulti`, the reserved slots filled
 * the way a deployment fills them, and the machine's verdict on the caller's own input is the assertion.
 */

const CATEGORY_CALLER = seededCategory('run apart from batch caller');
const CATEGORY_CALLEE = seededCategory('run apart from batch callee');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + '   string public name;'
  + '   mapping(address => uint) balances;'
  + '   function set(address to, uint amount) {'
  + '     balances[to] = amount;'
  + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
  + '     this.name = "hi";'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const caller = artifacts.Caller!;

type Program = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<Program['transaction']>;
type VmInput = VmTransaction['inputs'][number];
type VmOutput = VmTransaction['outputs'][number];

const CALLER_INDEX = 0;
const USER_INDEX = 1;
const STATE_INDEX = 2;
const PRED_INDEX = 3;
const CALLEE_INDEX = 4;
const VALIDATOR_INDEX = 5;
/** The created node and the created chunk sit at outputs no input recreates. */
const NODE_INDEX = 1;
const CHUNK_INDEX = 6;
const EXTRA_CHUNK_INDEX = 7;
const NONE = 0xffff;
const VALUE = 20_000n;
const EMPTY = new Uint8Array(0);

const TO = new Uint8Array(20).fill(0x33);
const VALUE_TAIL = new Uint8Array([42]);
const SLOT = keyToSlot(TO);
const ZERO_SLOT = new Uint8Array(32);
const HEAD_BEFORE = encodeEntryCommitment(ZERO_SLOT, ZERO_SLOT);
const HEAD_AFTER = encodeEntryCommitment(ZERO_SLOT, SLOT);
const NODE_COMMITMENT = encodeEntryCommitment(SLOT, ZERO_SLOT, VALUE_TAIL);

const utf8 = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'utf8'));
const header = (value: Uint8Array): Uint8Array =>
  hexToBin(buildPushdataCommitment(caller.stateLayout!, { name: value }, 0));
const HEADER_BEFORE = header(EMPTY);
const HEADER_AFTER = header(utf8('hi'));
const CHUNK = hexToBin(buildChunkCommitment(0, utf8('hi')));

const token = (
  category: Uint8Array, capability: 'minting' | 'mutable', commitment: Uint8Array = EMPTY,
): VmOutput['token'] => ({ category, amount: 0n, nft: { capability, commitment } });

function fill(name: 'Caller' | 'Callee'): Uint8Array {
  const artifact: Artifact = artifacts[name]!;
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(name === 'Caller' ? CATEGORY_CALLER : CATEGORY_CALLEE),
    contractAddress: name === 'Caller' ? ADDRESS_CALLER : ADDRESS_CALLEE,
    templateHash: TEMPLATE_HASH,
  });
}

/** The batch's segment: the state record kept, then the insert's group, the relinked head and the created node. */
const BATCH_SEGMENT: RecordEntry[] = [
  { in: STATE_INDEX, out: STATE_INDEX, viewIn: HEADER_BEFORE, viewOut: HEADER_BEFORE },
  { in: PRED_INDEX, out: PRED_INDEX, viewIn: HEAD_BEFORE, viewOut: HEAD_AFTER },
  { in: NONE, out: NODE_INDEX, viewIn: EMPTY, viewOut: NODE_COMMITMENT },
];
/** The run's segment: the state record written, then the run alone - one created chunk. */
const RUN_SEGMENT: RecordEntry[] = [
  { in: STATE_INDEX, out: STATE_INDEX, viewIn: HEADER_BEFORE, viewOut: HEADER_AFTER },
  { in: NONE, out: CHUNK_INDEX, viewIn: EMPTY, viewOut: CHUNK },
];

/**
 * The caller input's verdict over the two segments it declares, with the objection for a diagnosis. `extraChunks`
 * more chunk outputs follow the run's own, each carrying the chunk the run writes.
 */
function verdict(segments: readonly RecordEntry[][], extraChunks = 0): { accepted: boolean; objection?: string } {
  const callerProgram = fill('Caller');
  const calleeProgram = fill('Callee');
  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });
  const callerLock = encodeLockingBytecodeP2sh32(hash256(callerProgram));
  const calleeLock = encodeLockingBytecodeP2sh32(hash256(calleeProgram));
  const entryLock = encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(buildEntryNftCovenantScript(
    CATEGORY_CALLER, computeCollectionHash(caller.stateLayout!.collections![0]!.signature),
  ))));
  const chunkLock = encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(buildEntryNftCovenantScript(
    CATEGORY_CALLER, computeCollectionHash(dynamicChunkSignature('name', 'string')),
  ))));
  const stateLock = dataRecordLock(CATEGORY_CALLER);
  const block = (kind: number, records: readonly RecordEntry[][]): WitnessBlock => ({
    kind,
    callerRef: kind === 0 ? USER_INDEX : CALLER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: kind === 0 ? USER_LOCK : ADDRESS_CALLER,
    self: kind === 0 ? ADDRESS_CALLER : ADDRESS_CALLEE,
    value: 0n,
    retval: EMPTY,
    calls: kind === 0 ? [{
      kind: 1, target: ADDRESS_CALLEE, value: 0n, calleeRef: CALLEE_INDEX, argsHash: sha256(CALLEE_SELECTOR),
      result: EMPTY,
    }] : [],
    segments: [...records],
    events: [],
    sends: [],
  });
  const input = (fillByte: number, unlockingBytecode: Uint8Array): VmInput => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(fillByte), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const inputs: VmInput[] = [];
  inputs[CALLER_INDEX] = input(1, new Uint8Array([
    ...encodeDataPush(encodeWitnessBlock(block(0, [...segments]))),
    ...encodeDataPush(VALUE_TAIL),
    ...encodeDataPush(TO),
    ...encodeDataPush(callerProgram),
  ]));
  inputs[USER_INDEX] = input(4, callerUnlockingBytecode());
  inputs[STATE_INDEX] = input(2, encodeDataPush(new Uint8Array([1])));
  inputs[PRED_INDEX] = input(5, encodeDataPush(new Uint8Array([1])));
  inputs[CALLEE_INDEX] = input(6, new Uint8Array([
    ...encodeDataPush(encodeWitnessBlock(block(1, [[]]))),
    ...encodeDataPush(CALLEE_SELECTOR),
    ...encodeDataPush(calleeProgram),
  ]));
  inputs[VALIDATOR_INDEX] = input(7, validator.unlockingBytecode);

  const outputs: VmOutput[] = [];
  outputs[CALLER_INDEX] = { lockingBytecode: callerLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'minting') };
  outputs[NODE_INDEX] = {
    lockingBytecode: entryLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', NODE_COMMITMENT),
  };
  outputs[STATE_INDEX] = {
    lockingBytecode: stateLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', HEADER_AFTER),
  };
  outputs[PRED_INDEX] = {
    lockingBytecode: entryLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', HEAD_AFTER),
  };
  outputs[CALLEE_INDEX] = { lockingBytecode: calleeLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLEE, 'minting') };
  outputs[VALIDATOR_INDEX] = {
    lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable'),
  };
  const chunkOutput = { lockingBytecode: chunkLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', CHUNK) };
  outputs[CHUNK_INDEX] = chunkOutput;
  for (let extra = 0; extra < extraChunks; extra += 1) outputs.push(chunkOutput);

  const sourceOutputs: Program['sourceOutputs'] = [];
  sourceOutputs[CALLER_INDEX] = outputs[CALLER_INDEX];
  sourceOutputs[USER_INDEX] = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  sourceOutputs[STATE_INDEX] = {
    lockingBytecode: stateLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', HEADER_BEFORE),
  };
  sourceOutputs[PRED_INDEX] = {
    lockingBytecode: entryLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', HEAD_BEFORE),
  };
  sourceOutputs[CALLEE_INDEX] = outputs[CALLEE_INDEX];
  sourceOutputs[VALIDATOR_INDEX] = outputs[VALIDATOR_INDEX];

  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: CALLER_INDEX, sourceOutputs, transaction: { version: 2, inputs, outputs, locktime: 0 },
  });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a framed master whose batch and dynamic run land in different segments', () => {
  it('settles the batch in its own segment and the run in the segment the call opened', () => {
    // The artifact publishes that the frame reads the run apart from its batch, which is what lets a builder declare
    // the two in different segments.
    const entry = caller.composition?.stopSites?.entries.find((candidate) => candidate.functionName === 'Caller.set()');
    expect(entry?.writeSegments).toContainEqual({ variable: 'name', segment: 'last', apart: true });
    const outcome = verdict([BATCH_SEGMENT, RUN_SEGMENT]);
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('refuses a forged run: one record wider than the run the body pins, or declared beside the batch', () => {
    // A created chunk past the run in the run's own segment is a record no code pinned, which the frame's close of
    // that segment refuses now that no batch walk counts the records there.
    const wider = [...RUN_SEGMENT, { in: NONE, out: EXTRA_CHUNK_INDEX, viewIn: EMPTY, viewOut: CHUNK }];
    expect(verdict([BATCH_SEGMENT, wider], 1).accepted).toBe(false);
    // The run declared past the batch's groups, where a frame that reads it apart holds the batch's segment to the
    // value chunks it pins, and no run where the run's own segment should hold it.
    const besideBatch = [...BATCH_SEGMENT, RUN_SEGMENT[1]!];
    expect(verdict([besideBatch, [RUN_SEGMENT[0]!]]).accepted).toBe(false);
    expect(verdict([BATCH_SEGMENT, RUN_SEGMENT]).accepted).toBe(true);
  });
});
