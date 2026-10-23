import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh,
  hash256,
} from '@bitauth/libauth';
import {
  computeEventNameHash, encodeArgumentList, encodeIntegerValue, encodeWitnessBlock,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { deployMaster } from '../../../../solidcash/src/framed/deploy/index.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { categorySlotValue, seededCategory } from './validator-input.js';

/**
 * A framed master whose constructor emits an event.
 *
 * A master runs one head and then one of several bodies: its entries and its constructor. The head parks a
 * fixed-size event region, and each body pins the number of events it emits against the count the witness block
 * declares, so the constructor's event and an entry that emits nothing coexist. The deployment slots are filled
 * through the shipped deployment and the BCH-2026 machine is asked for a verdict on the constructor's own spend.
 *
 * Each refusal is shown beside the case it does not touch, so the machine's verdict is the check under test.
 */

const CATEGORY = seededCategory('constructor event');
/** The validator program. This master only bakes the address; the transaction never spends a validator. */
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

const MASTER_INDEX = 0;
const USER_INDEX = 1;
const MASTER_VALUE = 20_000n;
const EVENT_VALUE = 1_000n;
const SEED = 5;
/** The listed output index: past a filler output, so a block-layout read would land on the filler instead. */
const EVENT_OUTPUT = 2;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Launcher {'
  + '   event Launched(int value);'
  + '   constructor(int seed) { emit Launched(seed); }'
  + '   function idle() { require(true); }'
  + ' }';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

const artifact = compileString(SOURCE, { composition: 'framed' });
const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
const masterLock = deployed.lockingBytecode;

const selectorOf = (name: string): Uint8Array =>
  new Uint8Array(Buffer.from(artifact.abi.find((entry) => entry.name === name)!.selector!, 'hex'));
const CONSTRUCTOR_SELECTOR = selectorOf('__construct');
const IDLE_SELECTOR = selectorOf('idle');

/**
 * The lock the constructor body recomputes for its event: the contract's category and capability check, the event
 * signature hash and the relative timelock, hashed into a P2SH32 lock.
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

const eventLock = eventCovenantLock(artifact.events![0]!.signature);

/** A token, with an NFT capability and commitment where one is wanted. */
function token(
  capability: 'minting' | 'none',
  commitment: Uint8Array = new Uint8Array(0),
): VmOutput['token'] {
  return { category: CATEGORY, amount: 0n, nft: { capability, commitment } };
}

/** The event's payload, in the one encoding the wire format allows: the minimal push of its script number. */
function payload(value: number): Uint8Array {
  return encodeArgumentList([encodeIntegerValue(BigInt(value))]);
}

/** An output the event does not sit at, so a read of the wrong index finds no token there. */
const FILLER: VmOutput = { lockingBytecode: USER_LOCK, valueSatoshis: EVENT_VALUE };

/** The event output: the covenant lock, the contract's category with no capability, and the payload. */
function eventOutput(lock: Uint8Array = eventLock, value: number = SEED): VmOutput {
  return { lockingBytecode: lock, valueSatoshis: EVENT_VALUE, token: token('none', payload(value)) };
}

/** The block a root frame stands in: a user's caller, no validator, no call, one empty segment. */
function baseBlock(overrides: Partial<WitnessBlock> = {}): WitnessBlock {
  return {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: deployed.address,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [EVENT_OUTPUT],
    sends: [],
    ...overrides,
  };
}

/** Builds the spend of the deployed master and asks the BCH-2026 machine for a verdict. */
function verdict(options: {
  readonly selector: Uint8Array;
  readonly block: WitnessBlock;
  readonly argumentPushes?: Uint8Array;
  readonly outputs: readonly VmOutput[];
}): { accepted: boolean; objection?: string } {
  const masterInput = {
    outpointIndex: 0,
    // A constructor runs only where input 0, here the master's own, spends the category's genesis outpoint.
    outpointTransactionHash: options.selector === CONSTRUCTOR_SELECTOR
      ? CATEGORY
      : Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0xfe : 0x01)),
    sequenceNumber: 0xffffffff,
    // The convention's unlocker: the witness block, then the selector, then the body's argument pushes.
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(options.block)),
      ...encodeDataPush(options.selector),
      ...(options.argumentPushes ?? new Uint8Array(0)),
      ...encodeDataPush(deployed.script),
    ]),
  };
  const userInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(4),
    sequenceNumber: 0xffffffff,
    // The user's signed P2PKH input: the root frame reads its signature's hash type.
    unlockingBytecode: callerUnlockingBytecode(),
  };
  const masterOutput: VmOutput = {
    lockingBytecode: masterLock, valueSatoshis: MASTER_VALUE, token: token('minting'),
  };
  const transaction: VmTransaction = {
    version: 2,
    inputs: [masterInput, userInput],
    outputs: [masterOutput, ...options.outputs],
    locktime: 0,
  };
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    masterOutput,
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** Spends the master into the constructor body; the overrides change the one fact under test. */
const spendConstructor = (overrides: {
  readonly block?: WitnessBlock;
  readonly argumentPushes?: Uint8Array;
  readonly outputs?: readonly VmOutput[];
} = {}): { accepted: boolean; objection?: string } => verdict({
  selector: CONSTRUCTOR_SELECTOR,
  block: overrides.block ?? baseBlock(),
  argumentPushes: overrides.argumentPushes ?? payload(SEED),
  outputs: overrides.outputs ?? [FILLER, eventOutput()],
});

describe('a framed master whose constructor emits an event', () => {
  it('publishes the constructor as a dispatched body beside its entry', () => {
    expect(artifact.composition?.convention).toBe('framed');
    expect(artifact.abi.map((entry) => entry.name)).toContain('__construct');
    expect(deployed.script.length).toBeGreaterThan(0);
  });

  it('is accepted when the constructor emits the one event the block lists', () => {
    // The listed index is 2, past a filler output. A block-layout read would land on output 1, where no token
    // sits, so the accept is the body reading the slot the head parked.
    expect(spendConstructor()).toStrictEqual({ accepted: true });
  });

  it('is refused when the listed output is not the contract\'s event covenant', () => {
    expect(spendConstructor({ outputs: [FILLER, eventOutput(USER_LOCK)] }).accepted).toBe(false);
    // The control: the covenant lock beside it is accepted.
    expect(spendConstructor().accepted).toBe(true);
  });

  it('is refused when the block declares no event although the constructor emits one', () => {
    // The head leaves the region; the constructor body pins the declared count against its own emit count.
    expect(spendConstructor({ block: baseBlock({ events: [] }), outputs: [] }).accepted).toBe(false);
    // The control: the one event the constructor emits is accepted.
    expect(spendConstructor().accepted).toBe(true);
  });

  it('is refused when the entry runs while the block declares the constructor\'s event', () => {
    // `idle` emits nothing, so the same block the constructor accepts is refused by the entry's own count check.
    const spend = verdict({
      selector: IDLE_SELECTOR,
      block: baseBlock(),
      outputs: [FILLER, eventOutput()],
    });
    expect(spend.accepted).toBe(false);
  });

  it('is accepted when the entry runs with the block declaring no event', () => {
    expect(verdict({
      selector: IDLE_SELECTOR,
      block: baseBlock({ events: [] }),
      outputs: [],
    })).toStrictEqual({ accepted: true });
  });
});
