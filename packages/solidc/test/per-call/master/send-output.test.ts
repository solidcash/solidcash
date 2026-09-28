import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, encodeArgumentList, encodeIntegerValue, encodeWitnessBlock,
  scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/per-call/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { categorySlotValue, seededCategory } from './validator-input.js';

/**
 * A compiled per-call entry that makes a value send, driven through the real entry point.
 *
 * A listed send's recipient lock is a run-time value the entry's own code computes, so the head leaves the output
 * index the witness lists as a tracked slot and the body pins the lock and the value it computed at that output.
 * The cases below build the spend the way the compiler does and mutate one fact at a time, so the machine's
 * verdict is the check under test. The conditional shape sends on one branch only, so its region position must
 * hold the no-index sentinel when the execution does not send.
 */

const CATEGORY = seededCategory('send output');
/** The validator program. A standalone master only bakes the address; this one never spends a validator. */
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const OTHER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x44));

const MASTER_INDEX = 0;
const USER_INDEX = 1;
const MASTER_VALUE = 20_000n;
const AMOUNT = 10_000;

type Artifact = ReturnType<typeof compileString>;
type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

/** The stateless entry: one unconditional send to the frame's sender. */
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Sender { function pay(int amount) { this.transfer(msg.sender, amount); require(true); } }';

/** The conditional entry: the send happens only when the argument is positive. */
const CONDITIONAL_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Sender {'
  + '   function pay(int amount) { if (amount > 0) { this.transfer(msg.sender, amount); } require(true); }'
  + ' }';

/** The stateful entry: the send runs beside a record write the frame settles. */
const STATEFUL_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Sender {'
  + '   int public counter;'
  + '   function pay(int amount) { this.counter = this.counter + 1; this.transfer(msg.sender, amount); require(true); }'
  + ' }';

const compiledBySource = new Map<string, Artifact>();
const compile = (source: string): Artifact => {
  let artifact = compiledBySource.get(source);
  if (artifact === undefined) {
    artifact = compileString(source, { composition: 'per-call' });
    compiledBySource.set(source, artifact);
  }
  return artifact;
};

/** The deployed program and lock: the reserved slots filled the way deployment fills them. */
function deploy(source: string): { artifact: Artifact; program: Uint8Array; lock: Uint8Array } {
  const artifact = compile(source);
  const { placeholders } = artifact.composition!;
  const program = fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), placeholders, {
    category: categorySlotValue(CATEGORY),
    contractAddress: ADDRESS,
    ...(placeholders.templateHashOffset === undefined ? {} : { templateHash: TEMPLATE_HASH }),
  });
  return { artifact, program, lock: encodeLockingBytecodeP2sh32(hash256(program)) };
}

/** A token, with an NFT capability and commitment where one is wanted. */
function token(
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
  commitment: Uint8Array = new Uint8Array(0),
): VmOutput['token'] {
  return { category, amount: 0n, nft: { capability, commitment } };
}

/** The send's argument push, in the one encoding the wire format allows: the minimal push of its script number. */
function payload(value: number): Uint8Array {
  return encodeArgumentList([encodeIntegerValue(BigInt(value))]);
}

/** The block a root frame stands in: a user's caller, no validator, no call. */
function baseBlock(overrides: Partial<WitnessBlock> = {}): WitnessBlock {
  return {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: ADDRESS,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
    ...overrides,
  };
}

/** One spend of a compiled master: the outputs after its own recreation and the send list the block declares. */
interface Spend {
  readonly source: string;
  readonly block: WitnessBlock;
  /** The outputs after the master's own recreation at index 0. */
  readonly outputs: readonly VmOutput[];
  /** The argument push the unlocking bytecode carries. */
  readonly argumentPushes: Uint8Array;
  /**
   * A state record the entry reads and writes: the commitment the transaction spends and the one it writes, at the
   * input and output right after the master.
   */
  readonly state?: { readonly committed: Uint8Array; readonly written: Uint8Array };
}

/** Builds the spend of a compiled master and asks the BCH-2026 machine. */
function verdict(spend: Spend): { accepted: boolean; objection?: string } {
  const { program, lock } = deploy(spend.source);
  const record = spend.state;
  const recordInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(3),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };
  const inputs = [
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(2),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(spend.block)),
        ...spend.argumentPushes,
        ...encodeDataPush(program),
      ]),
    },
    ...(record === undefined ? [] : [recordInput]),
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(4),
      sequenceNumber: 0xffffffff,
      // The user's signed P2PKH input: the root frame reads its signature's hash type.
      unlockingBytecode: callerUnlockingBytecode(),
    },
  ];
  const masterOutput: VmOutput = {
    lockingBytecode: lock, valueSatoshis: MASTER_VALUE, token: token(CATEGORY, 'minting'),
  };
  const recordOutput: VmOutput[] = record === undefined ? [] : [{
    lockingBytecode: USER_LOCK,
    valueSatoshis: MASTER_VALUE,
    token: token(CATEGORY, 'mutable', record.written),
  }];
  const transaction: VmTransaction = {
    version: 2,
    inputs,
    outputs: [masterOutput, ...recordOutput, ...spend.outputs],
    locktime: 0,
  };
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    masterOutput,
    ...(record === undefined
      ? []
      : [{ lockingBytecode: USER_LOCK, valueSatoshis: MASTER_VALUE, token: token(CATEGORY, 'mutable', record.committed) }]),
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** A filler output the send does not sit at, so a read of the wrong index finds the wrong lock. */
const FILLER: VmOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 1_000n };
/** The send output: an ordinary payment of the amount to a lock the body computes. */
const sendOutput = (lock: Uint8Array, value: bigint): VmOutput =>
  ({ lockingBytecode: lock, valueSatoshis: value });

describe('an entry that sends to a run-time lock, compiled per-call', () => {
  /** The listed output sits past a filler, so it differs from what a block-layout offset would read. */
  const SEND_OUTPUT = 2;
  const spend = (overrides: Partial<Spend> = {}): { accepted: boolean; objection?: string } => verdict({
    source: SOURCE,
    block: baseBlock({ sends: [SEND_OUTPUT] }),
    outputs: [FILLER, sendOutput(USER_LOCK, BigInt(AMOUNT))],
    argumentPushes: payload(AMOUNT),
    ...overrides,
  });

  it('is accepted with the send at the output the witness lists', () => {
    expect(spend()).toStrictEqual({ accepted: true });
  });

  it('is refused when the listed output carries another lock', () => {
    expect(spend({ outputs: [FILLER, sendOutput(OTHER_LOCK, BigInt(AMOUNT))] }).accepted).toBe(false);
    // The control: the lock the body computed is accepted beside it.
    expect(spend().accepted).toBe(true);
  });

  it('is refused when the listed output carries another value', () => {
    expect(spend({ outputs: [FILLER, sendOutput(USER_LOCK, BigInt(AMOUNT + 1))] }).accepted).toBe(false);
  });

  it('is refused when the witness lists no send although the entry makes one', () => {
    expect(spend({ block: baseBlock(), outputs: [] }).accepted).toBe(false);
  });

  it('is refused when the witness lists an output index the send does not sit at', () => {
    // The send sits at output 2 but the record names output 1, where the filler holds another value.
    expect(spend({
      block: baseBlock({ sends: [1] }),
      outputs: [FILLER, sendOutput(USER_LOCK, BigInt(AMOUNT))],
    }).accepted).toBe(false);
  });
});

describe('an entry whose send runs on one branch, compiled per-call', () => {
  const SEND_OUTPUT = 2;
  const spend = (
    sends: number[], outputs: readonly VmOutput[], amount: number,
  ): { accepted: boolean; objection?: string } => verdict({
    source: CONDITIONAL_SOURCE,
    block: baseBlock({ sends }),
    outputs,
    argumentPushes: payload(amount),
  });

  it('is accepted when the send is taken and listed', () => {
    expect(spend([SEND_OUTPUT], [FILLER, sendOutput(USER_LOCK, BigInt(AMOUNT))], AMOUNT))
      .toStrictEqual({ accepted: true });
  });

  it('is refused when the send is taken and the witness lists nothing', () => {
    // The slot holds the sentinel, and the taken send reads it as an output index.
    expect(spend([], [], AMOUNT).accepted).toBe(false);
  });

  it('is refused when the witness lists a send the execution did not make', () => {
    expect(spend([SEND_OUTPUT], [FILLER, sendOutput(USER_LOCK, BigInt(AMOUNT))], 0).accepted).toBe(false);
    // The control: the same spend with no send listed is accepted, the position holding the sentinel.
    expect(spend([], [FILLER], 0)).toStrictEqual({ accepted: true });
  });
});

describe('a stateful entry that sends, compiled per-call', () => {
  const SEND_OUTPUT = 3;
  const stateful = deploy(STATEFUL_SOURCE);
  const commitment = (counter: bigint): Uint8Array =>
    new Uint8Array(Buffer.from(buildPushdataCommitment(stateful.artifact.stateLayout!, { counter }, 0), 'hex'));
  const COMMITTED = commitment(5n);
  const WRITTEN = commitment(6n);
  /** The record at input and output 1; the filler and the send follow it, so the send sits at output 3. */
  const STATE_INDEX = 1;

  const spend = (overrides: Partial<Spend> = {}): { accepted: boolean; objection?: string } => verdict({
    source: STATEFUL_SOURCE,
    block: baseBlock({
      callerRef: 2,
      originRef: 2,
      sends: [SEND_OUTPUT],
      segments: [[{ in: STATE_INDEX, out: STATE_INDEX, viewIn: COMMITTED, viewOut: WRITTEN }]],
    }),
    state: { committed: COMMITTED, written: WRITTEN },
    outputs: [FILLER, sendOutput(USER_LOCK, BigInt(AMOUNT))],
    argumentPushes: payload(AMOUNT),
    ...overrides,
  });

  it('is accepted when the segment declares the record and the send sits at the listed output', () => {
    expect(spend()).toStrictEqual({ accepted: true });
  });

  it('is refused when the record output is not the declared one', () => {
    expect(spend({ state: { committed: COMMITTED, written: commitment(9n) } }).accepted).toBe(false);
  });

  it('is refused when the listed output carries another lock', () => {
    expect(spend({ outputs: [FILLER, sendOutput(OTHER_LOCK, BigInt(AMOUNT))] }).accepted).toBe(false);
  });

  it('is refused when the listed output carries another value', () => {
    expect(spend({ outputs: [FILLER, sendOutput(USER_LOCK, BigInt(AMOUNT + 1))] }).accepted).toBe(false);
  });
});
