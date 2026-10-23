import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
  hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, buildChunkCommitment, buildEntryNftCovenantScript, buildPushdataCommitment, computeCollectionHash,
  computeFunctionSelector, computeFunctionSignature, dynamicChunkSignature, encodeInt, encodePushdataValue,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type Artifact, type RecordEntry, type WitnessBlock,
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
 * A framed master that reads its run apart from its batch before the batch's segment closes, through the batch's
 * own key.
 *
 * The entry inserts a mapping node keyed by an element of its own dynamic array, makes a call, then writes that
 * element: the batch's records are declared in the segment the call closes and the run in the one it opens. The
 * master derives the batch's operands at the top of its body, so the key's read of the run runs in the batch's
 * segment, and it resolves the run where the run's own segment declares it, as every other read of the run does.
 * The whole shipped path runs: the source through `compileStringMulti`, the reserved slots filled the way a
 * deployment fills them, and the machine's verdict on the caller's own input is the assertion.
 */

const CATEGORY_CALLER = seededCategory('run apart key read caller');
const CATEGORY_CALLEE = seededCategory('run apart key read callee');
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
  + '   address[] owners;'
  + '   mapping(address => uint) balances;'
  + '   function set(uint index, address next, uint amount) {'
  + '     balances[this.owners[index]] = amount;'
  + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
  + '     this.owners[index] = next;'
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
/** The run's one chunk, spent and rewritten at the same index. */
const CHUNK_INDEX = 6;
/** The created node sits at an output no input recreates. */
const NODE_INDEX = 1;
const EXTRA_CHUNK_INDEX = 7;
const NONE = 0xffff;
const VALUE = 20_000n;
const EMPTY = new Uint8Array(0);

/** The array holds one owner, the key the batch writes, and the entry overwrites it. */
const OWNER = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x33));
const NEXT = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x44));
const VALUE_TAIL = new Uint8Array([42]);
const SLOT = keyToSlot(OWNER);
const ZERO_SLOT = new Uint8Array(32);
const HEAD_BEFORE = encodeEntryCommitment(ZERO_SLOT, ZERO_SLOT);
const HEAD_AFTER = encodeEntryCommitment(ZERO_SLOT, SLOT);
const NODE_COMMITMENT = encodeEntryCommitment(SLOT, ZERO_SLOT, VALUE_TAIL);

const OWNERS_BEFORE = encodePushdataValue([OWNER], 'address[]');
const OWNERS_AFTER = encodePushdataValue([NEXT], 'address[]');
/** Both versions are one owner long, so the length header is the same on either side. */
const HEADER = hexToBin(buildPushdataCommitment(caller.stateLayout!, { owners$len: BigInt(OWNERS_BEFORE.length) }, 0));
const CHUNK_BEFORE = hexToBin(buildChunkCommitment(0, OWNERS_BEFORE));
const CHUNK_AFTER = hexToBin(buildChunkCommitment(0, OWNERS_AFTER));

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
  { in: STATE_INDEX, out: STATE_INDEX, viewIn: HEADER, viewOut: HEADER },
  { in: PRED_INDEX, out: PRED_INDEX, viewIn: HEAD_BEFORE, viewOut: HEAD_AFTER },
  { in: NONE, out: NODE_INDEX, viewIn: EMPTY, viewOut: NODE_COMMITMENT },
];
/** The run's segment: the state record rewritten, then the run alone - its one chunk, spent and rewritten. */
const RUN_SEGMENT: RecordEntry[] = [
  { in: STATE_INDEX, out: STATE_INDEX, viewIn: HEADER, viewOut: HEADER },
  { in: CHUNK_INDEX, out: CHUNK_INDEX, viewIn: CHUNK_BEFORE, viewOut: CHUNK_AFTER },
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
    CATEGORY_CALLER, computeCollectionHash(dynamicChunkSignature('owners', 'address[]')),
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
  // The arguments go last parameter first: amount, next, then index 0 nearest the program.
  inputs[CALLER_INDEX] = input(1, new Uint8Array([
    ...encodeDataPush(encodeWitnessBlock(block(0, [...segments]))),
    ...encodeDataPush(VALUE_TAIL),
    ...encodeDataPush(NEXT),
    ...encodeDataPush(encodeInt(0n)),
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
  inputs[CHUNK_INDEX] = input(8, new Uint8Array([0x00, 0x51]));

  const outputs: VmOutput[] = [];
  outputs[CALLER_INDEX] = { lockingBytecode: callerLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'minting') };
  outputs[NODE_INDEX] = {
    lockingBytecode: entryLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', NODE_COMMITMENT),
  };
  outputs[STATE_INDEX] = {
    lockingBytecode: stateLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', HEADER),
  };
  outputs[PRED_INDEX] = {
    lockingBytecode: entryLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', HEAD_AFTER),
  };
  outputs[CALLEE_INDEX] = { lockingBytecode: calleeLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLEE, 'minting') };
  outputs[VALIDATOR_INDEX] = {
    lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable'),
  };
  const chunkOutput = {
    lockingBytecode: chunkLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', CHUNK_AFTER),
  };
  outputs[CHUNK_INDEX] = chunkOutput;
  for (let extra = 0; extra < extraChunks; extra += 1) outputs.push(chunkOutput);

  const sourceOutputs: Program['sourceOutputs'] = [];
  sourceOutputs[CALLER_INDEX] = outputs[CALLER_INDEX];
  sourceOutputs[USER_INDEX] = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  sourceOutputs[STATE_INDEX] = outputs[STATE_INDEX];
  sourceOutputs[PRED_INDEX] = {
    lockingBytecode: entryLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', HEAD_BEFORE),
  };
  sourceOutputs[CALLEE_INDEX] = outputs[CALLEE_INDEX];
  sourceOutputs[VALIDATOR_INDEX] = outputs[VALIDATOR_INDEX];
  sourceOutputs[CHUNK_INDEX] = {
    lockingBytecode: chunkLock, valueSatoshis: VALUE, token: token(CATEGORY_CALLER, 'mutable', CHUNK_BEFORE),
  };

  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: CALLER_INDEX, sourceOutputs, transaction: { version: 2, inputs, outputs, locktime: 0 },
  });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a framed master whose batch key reads its run before the batch\'s segment closes', () => {
  it('resolves the key\'s read of the run in the run\'s own segment, and settles the batch in its own', () => {
    // The artifact publishes the frame reads the run apart from its batch, so a builder declares the run only in the
    // segment the call opens, while the key the batch is derived from is read before that call.
    const entry = caller.composition?.stopSites?.entries.find((candidate) => candidate.functionName === 'Caller.set()');
    expect(entry?.writeSegments).toContainEqual(expect.objectContaining({ variable: 'owners', apart: true }));
    const outcome = verdict([BATCH_SEGMENT, RUN_SEGMENT]);
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('refuses a forged run: one record wider than the run the body pins, or declared beside the batch', () => {
    // A created chunk past the run in the run's own segment is a record no code pinned, which the close of that
    // segment refuses.
    const wider = [...RUN_SEGMENT, { in: NONE, out: EXTRA_CHUNK_INDEX, viewIn: EMPTY, viewOut: CHUNK_AFTER }];
    expect(verdict([BATCH_SEGMENT, wider], 1).accepted).toBe(false);
    // The run declared past the batch's groups, in the segment the key's read runs in, and not in its own: the read
    // looks for it in the run's segment, which holds no record there.
    const besideBatch = [...BATCH_SEGMENT, RUN_SEGMENT[1]!];
    expect(verdict([besideBatch, [RUN_SEGMENT[0]!]]).accepted).toBe(false);
    expect(verdict([BATCH_SEGMENT, RUN_SEGMENT]).accepted).toBe(true);
  });
});
