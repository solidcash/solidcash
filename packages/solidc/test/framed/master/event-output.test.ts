import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, computeEventNameHash, encodeArgumentList, encodeIntegerValue,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { categorySlotValue, dataRecordLock, seededCategory } from './validator-input.js';

/**
 * A compiled framed entry that emits an event, driven through the real entry point.
 *
 * The head walks the witness block's event list and leaves each listed output index as a tracked slot, so the body
 * checks the payload it computed against the output the witness listed instead of a block-layout offset a framed
 * master does not have. The event output is the contract's own event covenant: the body recomputes the lock from
 * the master's category and the event signature, so every case below builds that lock the way the compiler does.
 *
 * Each refusal is shown beside the case it does not touch, so the machine's verdict is the check under test.
 */

const CATEGORY = seededCategory('event output');
/** The validator program. A standalone master only bakes the address; this one never spends a validator. */
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

const MASTER_INDEX = 0;
const USER_INDEX = 1;
const MASTER_VALUE = 20_000n;
const EVENT_VALUE = 1_000n;
/** The value the entry emits, which the body encodes into the event's commitment. */
const EMITTED = 7;
/**
 * The listed output index. It sits past a filler output, so it differs from what a block-layout offset would
 * read (the active input's index plus the contract's event offset, which is 1 for this shape).
 */
const EVENT_OUTPUT = 2;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Emitter {'
  + '   event Ping(int value);'
  + '   function fire(int n) { emit Ping(n); require(true); }'
  + ' }';

/** The control: a master with no event at all, so the event slot machinery must leave it untouched. */
const QUIET_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Quiet { function idle() { require(true); } }';

type Artifact = ReturnType<typeof compileString>;
type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

/** Compiled once per source: the cases deploy the same few contracts, and compiling dominates the file. */
const compiledBySource = new Map<string, Artifact>();
const compile = (source: string): Artifact => {
  let artifact = compiledBySource.get(source);
  if (artifact === undefined) {
    artifact = compileString(source, { composition: 'framed' });
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

/**
 * The lock the body recomputes for an event: the contract's category and capability check, the event signature
 * hash and the relative timelock, hashed into a P2SH32 lock.
 */
function eventCovenantLock(signature: string): Uint8Array {
  const nameHash = computeEventNameHash(signature);
  const script = new Uint8Array([
    0xc0, 0xce, 0x01, 0x20, 0x7f, 0x7c, // OP_INPUTINDEX OP_UTXOTOKENCATEGORY <32> OP_SPLIT OP_SWAP
    0x20, ...categorySlotValue(CATEGORY), // the category in the order introspection reports it
    0x88, 0x00,                         // OP_EQUALVERIFY, empty capability
    0x88, 0x14, ...nameHash,            // OP_EQUALVERIFY, the event signature hash
    0x75, 0x02, 0x90, 0x00, 0xb2, 0x75, // OP_DROP <144> OP_CHECKSEQUENCEVERIFY OP_DROP
    0x51,                               // OP_1
  ]);
  return new Uint8Array([0xaa, 0x20, ...hash256(script), 0x87]);
}

/** A token, with an NFT capability and commitment where one is wanted. */
function token(
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
  commitment: Uint8Array = new Uint8Array(0),
): VmOutput['token'] {
  return { category, amount: 0n, nft: { capability, commitment } };
}

/** The event's payload, in the one encoding the wire format allows: the minimal push of its script number. */
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
    events: [EVENT_OUTPUT],
    sends: [],
    ...overrides,
  };
}

/** The event output: the covenant lock, the contract's category with no capability, and the payload. */
function eventOutput(commitment: Uint8Array, lock: Uint8Array, capability: 'none' | 'mutable' = 'none'): VmOutput {
  return { lockingBytecode: lock, valueSatoshis: EVENT_VALUE, token: token(CATEGORY, capability, commitment) };
}

/** An output the event does not sit at, so a read of the wrong index finds no token there. */
const FILLER: VmOutput = { lockingBytecode: USER_LOCK, valueSatoshis: EVENT_VALUE };

interface Spend {
  readonly source: string;
  readonly block: WitnessBlock;
  /** The outputs after the master's own recreation at index 0. */
  readonly outputs: readonly VmOutput[];
  /** The entry's selector, for a master with several entry points; absent for a single-entry master. */
  readonly selector?: Uint8Array;
  /** The argument push the unlocking bytecode carries, when the entry takes one. */
  readonly argumentPushes?: Uint8Array;
  /**
   * A state record the entry reads and writes: the commitment the transaction spends and the one it writes, at the
   * input and output right after the master. The segment declares the record the way the compiler's settlement
   * expects it, which is what makes the entry's own read land on it.
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
        ...(spend.selector === undefined ? [] : [...encodeDataPush(spend.selector)]),
        ...(spend.argumentPushes ?? new Uint8Array(0)),
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
    lockingBytecode: dataRecordLock(CATEGORY),
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
      : [{
        lockingBytecode: dataRecordLock(CATEGORY), valueSatoshis: MASTER_VALUE,
        token: token(CATEGORY, 'mutable', record.committed),
      }]),
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

const emitter = deploy(SOURCE);
const eventLock = eventCovenantLock(emitter.artifact.events![0]!.signature);

/** Spends the emitting master; the variant overrides the one fact under test. */
const spendEmitter = (overrides: Partial<Spend> = {}): { accepted: boolean; objection?: string } => verdict({
  source: SOURCE,
  block: baseBlock(),
  outputs: [FILLER, eventOutput(payload(EMITTED), eventLock)],
  argumentPushes: payload(EMITTED),
  ...overrides,
});

describe('an entry that emits an event, compiled framed', () => {
  it('is accepted with the event at the output the witness lists', () => {
    // The listed index is 2, past a filler output. A block-layout read would land on output 1 (the active input's
    // index plus this shape's event offset), where no token sits, so the accept is the body reading the slot.
    expect(spendEmitter()).toStrictEqual({ accepted: true });
  });

  it('is refused when an own-category immutable token sits at an output the witness does not list', () => {
    // The event is at the listed output 2; the same kind of token at output 3 is claimed by no witness entry.
    expect(spendEmitter({
      outputs: [
        FILLER,
        eventOutput(payload(EMITTED), eventLock),
        eventOutput(new Uint8Array([9]), eventLock),
      ],
    }).accepted).toBe(false);
  });

  it('is refused when the listed output is not where the event sits', () => {
    // The event sits at output 1 but the record names output 2, which is the filler.
    expect(spendEmitter({
      outputs: [eventOutput(payload(EMITTED), eventLock), FILLER],
    }).accepted).toBe(false);
  });

  it('is refused when the listed output carries another category', () => {
    const output = eventOutput(payload(EMITTED), eventLock);
    output.token = token(seededCategory('event output other'), 'none', payload(EMITTED));
    expect(spendEmitter({ outputs: [FILLER, output] }).accepted).toBe(false);
  });

  it('is refused when the listed output carries the category with the mutable capability', () => {
    expect(spendEmitter({
      outputs: [FILLER, eventOutput(payload(EMITTED), eventLock, 'mutable')],
    }).accepted).toBe(false);
  });

  it('is refused when the listed output carries no token at all', () => {
    expect(spendEmitter({
      outputs: [FILLER, { lockingBytecode: eventLock, valueSatoshis: EVENT_VALUE }],
    }).accepted).toBe(false);
  });

  it('is refused when the listed output carries a payload the body did not compute', () => {
    expect(spendEmitter({
      outputs: [FILLER, eventOutput(payload(EMITTED + 1), eventLock)],
    }).accepted).toBe(false);
    // The control: the payload the body computes is accepted beside it.
    expect(spendEmitter().accepted).toBe(true);
  });

  it('is refused when the listed output is not the event covenant', () => {
    expect(spendEmitter({
      outputs: [FILLER, eventOutput(payload(EMITTED), USER_LOCK)],
    }).accepted).toBe(false);
  });

  it('is refused when the witness lists no event although the entry emits one', () => {
    expect(spendEmitter({ block: baseBlock({ events: [] }), outputs: [] }).accepted).toBe(false);
  });

  it('is refused when the body computes a payload the listed output does not carry', () => {
    // The entry emits 7 but the unlocking bytecode passes 9, so the body's payload is 9's and the output is not.
    expect(spendEmitter({ argumentPushes: payload(EMITTED + 2) }).accepted).toBe(false);
  });
});

/**
 * A stateful framed entry that emits an event: its settlement and its event walk run on one input.
 *
 * The settlement parks its chain registers on the alternate stack, and the event walk parks each listed output
 * index there before the settlement runs, so the two have to keep out of each other's way. The record sits right
 * after the master, which is where a compiled body reads its state from.
 */
const STATEFUL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract StatefulEmitter {'
  + '   int public counter;'
  + '   event Ping(int value);'
  + '   function fire(int n) {'
  + '     this.counter = this.counter + 1;'
  + '     emit Ping(n);'
  + '     require(this.counter > 0);'
  + '   }'
  + ' }';

describe('a stateful entry that emits an event, compiled framed', () => {
  const stateful = deploy(STATEFUL_SOURCE);
  const statefulLock = eventCovenantLock(stateful.artifact.events![0]!.signature);
  const commitment = (counter: bigint): Uint8Array =>
    new Uint8Array(Buffer.from(buildPushdataCommitment(stateful.artifact.stateLayout!, { counter }, 0), 'hex'));
  const COMMITTED = commitment(5n);
  const WRITTEN = commitment(6n);
  /** The record at input and output 1; the event and the filler follow it, so the event sits at output 3. */
  const STATE_INDEX = 1;
  const EVENT_INDEX = 3;

  const spendStateful = (overrides: Partial<Spend> = {}): { accepted: boolean; objection?: string } => verdict({
    source: STATEFUL_SOURCE,
    block: baseBlock({
      callerRef: 2,
      originRef: 2,
      events: [EVENT_INDEX],
      segments: [[{ in: STATE_INDEX, out: STATE_INDEX, viewIn: COMMITTED, viewOut: WRITTEN }]],
    }),
    state: { committed: COMMITTED, written: WRITTEN },
    argumentPushes: payload(EMITTED),
    outputs: [FILLER, eventOutput(payload(EMITTED), statefulLock)],
    ...overrides,
  });

  it('is accepted when the segment declares the record the body reads and writes', () => {
    expect(spendStateful()).toStrictEqual({ accepted: true });
  });

  it('is refused when the segment declares a commitment the transaction does not spend', () => {
    expect(spendStateful({
      block: baseBlock({
        callerRef: 2,
        originRef: 2,
        events: [EVENT_INDEX],
        segments: [[{ in: STATE_INDEX, out: STATE_INDEX, viewIn: WRITTEN, viewOut: WRITTEN }]],
      }),
    }).accepted).toBe(false);
    // The control: the declaration the transaction does spend is accepted beside it.
    expect(spendStateful().accepted).toBe(true);
  });

  it('is refused when the listed event output carries a payload the body did not compute', () => {
    expect(spendStateful({
      outputs: [FILLER, eventOutput(payload(EMITTED + 1), statefulLock)],
    }).accepted).toBe(false);
  });

  it('is refused when the record output the transaction writes is not the declared one', () => {
    expect(spendStateful({ state: { committed: COMMITTED, written: commitment(9n) } }).accepted).toBe(false);
  });
});

describe('a compiled master with no event', () => {
  const quiet = deploy(QUIET_SOURCE);

  it('is still accepted when spent', () => {
    expect(verdict({
      source: QUIET_SOURCE,
      block: baseBlock({ events: [] }),
      outputs: [],
    })).toStrictEqual({ accepted: true });
  });

  it('publishes the address slot a standalone master checks its self against', () => {
    expect(quiet.artifact.composition?.convention).toBe('framed');
    expect(quiet.artifact.composition!.placeholders.addressOffset).toBeTypeOf('number');
  });
});

/** Two entries, each emitting the same event, so a selector reaches the same body shape under a dispatcher. */
const TWO_ENTRY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Emitter2 {'
  + '   event Ping(int value);'
  + '   function fire(int n) { emit Ping(n); require(true); }'
  + '   function other(int n) { emit Ping(n); require(true); }'
  + ' }';

/** A function's four-byte dispatcher selector, as the ABI publishes it. */
function selectorOf(artifact: Artifact, name: string): Uint8Array {
  return new Uint8Array(Buffer.from(artifact.abi.find((entry) => entry.name === name)!.selector!, 'hex'));
}

describe('a framed master whose entries are dispatched by a selector', () => {
  const twoEntry = deploy(TWO_ENTRY_SOURCE);
  const twoEntryLock = eventCovenantLock(twoEntry.artifact.events![0]!.signature);

  const spendTwoEntry = (selector: Uint8Array): { accepted: boolean; objection?: string } => verdict({
    source: TWO_ENTRY_SOURCE,
    block: baseBlock(),
    selector,
    argumentPushes: payload(EMITTED),
    outputs: [FILLER, eventOutput(payload(EMITTED), twoEntryLock)],
  });

  it('is accepted at the output the witness lists, whichever entry the selector reaches', () => {
    expect(spendTwoEntry(selectorOf(twoEntry.artifact, 'fire'))).toStrictEqual({ accepted: true });
    expect(spendTwoEntry(selectorOf(twoEntry.artifact, 'other'))).toStrictEqual({ accepted: true });
  });

  it('is refused when the listed output carries a payload the body did not compute', () => {
    expect(verdict({
      source: TWO_ENTRY_SOURCE,
      block: baseBlock(),
      selector: selectorOf(twoEntry.artifact, 'fire'),
      argumentPushes: payload(EMITTED),
      outputs: [FILLER, eventOutput(payload(EMITTED + 1), twoEntryLock)],
    }).accepted).toBe(false);
  });
});
