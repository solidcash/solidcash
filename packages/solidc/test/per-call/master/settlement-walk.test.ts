import { describe, expect, it } from 'vitest';
import {
  Opcodes, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  encodeWitnessBlock, sha256, validatorAddress, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { ADDRESS_SLOT_LENGTH, placeholderPrefixLength } from '../../../src/per-call/master/placeholders.js';
import { selfSettlementScript, type SelfSettlementShape } from '../../../src/per-call/master/frame-tail.js';

/**
 * The record chain a self-settling master walks: one transition across every segment of its execution.
 *
 * The walk is a shipped script, so this suite drives it on its own rather than through a compiled contract: a real
 * witness block, a real transaction, and the machine's verdict. What it establishes is what the compiled master
 * relies on — that the first declaration is the commitment the transaction spends, that each later one carries on
 * from the one before it, that the last is the commitment the transaction writes, and that the state UTXOs spent
 * and the state outputs written are exactly the record the chain names.
 */

const CATEGORY = sha256(new TextEncoder().encode('settlement walk record'));
/** The address the running script carries, read back by the census. Any 35-byte lock serves. */
const ADDRESS = validatorAddress(CATEGORY, sha256(new TextEncoder().encode('settlement walk program')));
const RECORD_LOCK = encodeLockingBytecodeP2sh32(hash256(new TextEncoder().encode('settlement walk record lock')));
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x31));
const VALUE = 20_000n;

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

const MASTER_INDEX = 0;
const RECORD_INDEX = 1;
const USER_INDEX = 2;

const commitment = (byte: number, length = 4): Uint8Array => new Uint8Array(length).fill(byte);
const BEFORE = commitment(0x11);
const MIDDLE = commitment(0x22);
const AFTER = commitment(0x33);

function token(
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
  tokenCommitment: Uint8Array = new Uint8Array(0),
): VmOutput['token'] {
  return { category, amount: 0n, nft: { capability, commitment: tokenCommitment } };
}

/** The record's declaration, as the witness block writes it. */
const kept = (viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry =>
  ({ in: RECORD_INDEX, out: RECORD_INDEX, viewIn, viewOut });

interface WalkOptions {
  /** One entry per segment, in execution order. */
  readonly segments: readonly (readonly RecordEntry[])[];
  /** The commitment the record's state UTXO actually carries. */
  readonly inputCommitment?: Uint8Array;
  /** The commitment the state output actually carries. */
  readonly outputCommitment?: Uint8Array;
  /** The value the state output carries, against the master's floor for the record. */
  readonly outputValue?: bigint;
  /** Spend a second state UTXO the segments do not declare. */
  readonly undeclaredRecord?: boolean;
  /** How many call records the block carries, which fixes how many segments it must declare. */
  readonly callCount?: number;
  /** Drop the state token from the second input and output, for a master whose execution carries no record. */
  readonly plainSecondPair?: boolean;
}

/** The program under test with the address slot the census reads, at the offset its own push puts it. */
function settlementProgram(shape: Omit<SelfSettlementShape, 'addressPayloadOffset'>): Uint8Array {
  const prefix = placeholderPrefixLength(ADDRESS_SLOT_LENGTH);
  let program = selfSettlementScript({ ...shape, addressPayloadOffset: 0 });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const payloadOffset = program.length + prefix;
    const next = selfSettlementScript({ ...shape, addressPayloadOffset: payloadOffset });
    if (next.length === program.length) {
      program = next;
      break;
    }
    program = next;
  }
  // The script carries its address the way a compiled master's reserved slot does, and the unlocking bytecode's own
  // copy of the block has to go the way a master's head removes it, so the evaluation ends on one item.
  const cleanup = new Uint8Array([
    Opcodes.OP_DROP, // the address this harness appended
    Opcodes.OP_DEPTH, Opcodes.OP_1SUB, Opcodes.OP_ROLL, Opcodes.OP_DROP, // the unlocking bytecode's copy of the block
    Opcodes.OP_1,
  ]);
  return new Uint8Array([...program, ...encodeDataPush(ADDRESS), ...cleanup]);
}

/** Builds the transaction the settlement walks and evaluates the master's own input. */
function evaluate(options: WalkOptions): { accepted: boolean; objection?: string } {
  // The codec fixes one segment per call plus one, so the block's calls follow from its segments.
  const callCount = options.callCount ?? options.segments.length - 1;
  const program = settlementProgram({
    callCount,
    segmentCount: options.segments.length,
    sendCount: 0,
  });
  const masterLock = encodeLockingBytecodeP2sh32(hash256(program));
  const block: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: ADDRESS,
    value: 0n,
    retval: new Uint8Array(0),
    calls: Array.from({ length: callCount }, () => ({
      kind: 1,
      target: USER_LOCK,
      value: 0n,
      calleeRef: USER_INDEX,
      argsHash: new Uint8Array(32).fill(7),
      result: new Uint8Array(0),
    })),
    segments: options.segments,
    events: [],
    sends: [],
  };

  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)), ...encodeDataPush(program),
    ]),
  };
  const recordInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(2),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };
  const undeclaredInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(3),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };
  const userInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(4),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };

  const masterOutput = { lockingBytecode: masterLock, valueSatoshis: VALUE, token: token(CATEGORY, 'minting') };
  const plain = options.plainSecondPair === true;
  const recordOutput = {
    lockingBytecode: plain ? USER_LOCK : RECORD_LOCK,
    valueSatoshis: options.outputValue ?? VALUE,
    ...(plain ? {} : { token: token(CATEGORY, 'mutable', options.outputCommitment ?? AFTER) }),
  };
  const userOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };

  const recordSource = {
    lockingBytecode: plain ? USER_LOCK : RECORD_LOCK,
    valueSatoshis: VALUE,
    ...(plain ? {} : { token: token(CATEGORY, 'mutable', options.inputCommitment ?? BEFORE) }),
  };
  const masterSource = { lockingBytecode: masterLock, valueSatoshis: VALUE, token: token(CATEGORY, 'minting') };
  const userSource = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };

  const inputs = options.undeclaredRecord === true
    ? [masterInput, recordInput, undeclaredInput, userInput]
    : [masterInput, recordInput, userInput];
  const outputs = [masterOutput, recordOutput, userOutput];
  const sourceOutputs = options.undeclaredRecord === true
    ? [masterSource, recordSource, { ...recordSource, token: token(CATEGORY, 'mutable', BEFORE) }, userSource]
    : [masterSource, recordSource, userSource];

  const vm = createVirtualMachineBch2026(false);
  const state = vm.evaluate({
    inputIndex: MASTER_INDEX,
    sourceOutputs,
    transaction: { version: 2, inputs, outputs, locktime: 0 },
  });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('the settlement walk chains a record across segments', () => {
  it('accepts two segments that chain into the commitment the transaction writes', () => {
    expect(evaluate({ segments: [[kept(BEFORE, MIDDLE)], [kept(MIDDLE, AFTER)]] }))
      .toStrictEqual({ accepted: true });
  });

  it('accepts a single segment that begins and ends at the transaction\'s own commitments', () => {
    expect(evaluate({ segments: [[kept(BEFORE, AFTER)]] })).toStrictEqual({ accepted: true });
  });

  it('accepts a segment that declares nothing, carrying the chain over it', () => {
    expect(evaluate({ segments: [[kept(BEFORE, MIDDLE)], [], [kept(MIDDLE, AFTER)]] }))
      .toStrictEqual({ accepted: true });
  });

  it('accepts a chain that runs through three declarations', () => {
    expect(evaluate({
      segments: [[kept(BEFORE, MIDDLE)], [kept(MIDDLE, MIDDLE)], [kept(MIDDLE, AFTER)]],
    })).toStrictEqual({ accepted: true });
  });

  it('refuses a second segment that does not carry on from the first', () => {
    expect(evaluate({ segments: [[kept(BEFORE, MIDDLE)], [kept(BEFORE, AFTER)]] }).accepted).toBe(false);
  });

  it('refuses a first segment that is not the commitment the transaction spends', () => {
    expect(evaluate({ segments: [[kept(MIDDLE, AFTER)]] }).accepted).toBe(false);
  });

  it('refuses a last segment that is not the commitment the transaction writes', () => {
    expect(evaluate({ segments: [[kept(BEFORE, MIDDLE)], [kept(MIDDLE, MIDDLE)]] }).accepted).toBe(false);
  });

  it('refuses a later segment that declares a record the chain does not name', () => {
    expect(evaluate({
      segments: [[kept(BEFORE, MIDDLE)], [{ in: RECORD_INDEX, out: RECORD_INDEX, viewIn: MIDDLE, viewOut: AFTER }]],
      outputCommitment: AFTER,
    }).accepted).toBe(true);
    expect(evaluate({
      segments: [[kept(BEFORE, MIDDLE)], [{ in: 0xffff, out: RECORD_INDEX, viewIn: MIDDLE, viewOut: AFTER }]],
    }).accepted).toBe(false);
  });

  it('refuses a segment that declares several records', () => {
    expect(evaluate({
      segments: [[kept(BEFORE, MIDDLE), kept(MIDDLE, AFTER)]],
    }).accepted).toBe(false);
    expect(evaluate({ segments: [[kept(BEFORE, AFTER)]] }).accepted).toBe(true);
  });

  it('refuses a state UTXO the segments do not declare', () => {
    expect(evaluate({ segments: [[kept(BEFORE, AFTER)]], undeclaredRecord: true }).accepted).toBe(false);
    expect(evaluate({ segments: [[kept(BEFORE, AFTER)]] }).accepted).toBe(true);
  });

  it('refuses a record that keeps less value than it held', () => {
    expect(evaluate({ segments: [[kept(BEFORE, AFTER)]], outputValue: VALUE - 1n }).accepted).toBe(false);
    expect(evaluate({ segments: [[kept(BEFORE, AFTER)]], outputValue: VALUE }).accepted).toBe(true);
  });

  it('walks a block with calls before the segments', () => {
    expect(evaluate({ segments: [[kept(BEFORE, MIDDLE)], [kept(MIDDLE, AFTER)]] }))
      .toStrictEqual({ accepted: true });
    // A chain the same block declares is still checked with the calls present.
    expect(evaluate({ segments: [[kept(BEFORE, MIDDLE)], [kept(MIDDLE, MIDDLE)]] }).accepted).toBe(false);
  });

  it('accepts a master whose execution declares no record at all', () => {
    // No record is declared and no state token is in the transaction: the census has nothing to refuse.
    expect(evaluate({ segments: [[], []], plainSecondPair: true })).toStrictEqual({ accepted: true });
    // The same declaration with a state token the segments never name is refused.
    expect(evaluate({ segments: [[], []] }).accepted).toBe(false);
    // One segment declaring nothing, with no state token in the transaction at all.
    expect(evaluate({ segments: [[]], plainSecondPair: true })).toStrictEqual({ accepted: true });
  });
});
