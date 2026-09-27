import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, computeEventNameHash, encodeArgumentList, encodeIntegerValue, encodeWitnessBlock, scriptToBytecode,
  sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { fillPlaceholders } from '../../../../solidc/src/per-call/master/placeholders.js';
import { callerUnlockingBytecode } from '../frames/caller-input.js';
import { categorySlotValue, seededCategory } from '../../../../solidc/test/per-call/master/validator-input.js';

/**
 * A compiled per-call entry that emits an event, and the listed output it must have computed.
 *
 * The head parks each listed output index, and the body recomputes the event covenant from its own category, the
 * event signature and the payload it is emitting, then checks the output the witness listed. An output the body
 * did not compute — someone else's bytes at that index — must be refused, so each case below compiles real source,
 * fills the deployment slots, and asks the BCH-2026 machine on a real transaction.
 */

const CATEGORY = seededCategory('hostile event output');
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const MASTER_VALUE = 20_000n;
const EVENT_VALUE = 1_000n;
/** The value the entry emits, which the body encodes into the event's commitment. */
const EMITTED = 7;
/** The listed output index, past a filler, so a block-layout read would land somewhere else. */
const EVENT_OUTPUT = 2;

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Emitter {'
  + '   event Ping(int value);'
  + '   function fire(int n) { emit Ping(n); require(true); }'
  + ' }';

const artifact = compileString(SOURCE, { composition: 'per-call' });
const program = fillPlaceholders(
  scriptToBytecode(asmToScript(artifact.bytecode)),
  artifact.composition!.placeholders,
  { category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: sha256(VALIDATOR_PROGRAM) },
);
const masterLock = encodeLockingBytecodeP2sh32(hash256(program));

/** The lock the body recomputes for the event: category, signature hash and timelock hashed into a P2SH32 lock. */
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

const token = (
  capability: 'minting' | 'mutable' | 'none',
  commitment: Uint8Array = new Uint8Array(0),
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category: CATEGORY, amount: 0n, nft: { capability, commitment } });

/** The event's payload, in the one encoding the wire format allows: the minimal push of its script number. */
function payload(value: number): Uint8Array {
  return encodeArgumentList([encodeIntegerValue(BigInt(value))]);
}

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

/** The block a root frame stands in: a user's caller, no validator, no call. */
const baseBlock = (events: readonly number[] = [EVENT_OUTPUT]): WitnessBlock => ({
  kind: 0,
  callerRef: 1,
  originRef: 1,
  validatorRef: 0xffff,
  sender: USER_LOCK,
  self: ADDRESS,
  value: 0n,
  retval: new Uint8Array(0),
  calls: [],
  segments: [[]],
  events: [...events],
  sends: [],
});

/** The event output: the covenant lock and the contract's category with no capability. */
function eventOutput(commitmentBytes: Uint8Array, lock: Uint8Array): VmOutput {
  return { lockingBytecode: lock, valueSatoshis: EVENT_VALUE, token: token('none', commitmentBytes) };
}

/** An output the event does not sit at, so a read of the wrong index finds no token there. */
const FILLER: VmOutput = { lockingBytecode: USER_LOCK, valueSatoshis: EVENT_VALUE };

interface Spend {
  readonly block?: WitnessBlock;
  readonly outputs?: readonly VmOutput[];
  readonly argumentPushes?: Uint8Array;
}

/** Builds and evaluates the spend of the emitting master. */
function evaluate(spend: Spend = {}): { accepted: boolean; objection?: string } {
  const block = spend.block ?? baseBlock();
  const outputs = spend.outputs ?? [FILLER, eventOutput(payload(EMITTED), eventLock)];
  const argumentPushes = spend.argumentPushes ?? payload(EMITTED);

  const transaction = {
    version: 2,
    inputs: [
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(2),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...argumentPushes,
          ...encodeDataPush(program),
        ]),
      },
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(4),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode(),
      },
    ],
    outputs: [
      { lockingBytecode: masterLock, valueSatoshis: MASTER_VALUE, token: token('minting') },
      ...outputs,
    ],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: masterLock, valueSatoshis: MASTER_VALUE, token: token('minting') },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const vm = createVirtualMachineBch2026(false);
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a compiled entry that emits an event refuses an output it did not compute', () => {
  it('accepts the event at the output the witness lists, so the refusals are not malformed spends', () => {
    expect(evaluate()).toStrictEqual({ accepted: true });
  });

  it('refuses a listed output holding bytes the body did not compute', () => {
    // The body emits 7, so it recomputes the covenant for 7's payload. Output 2 carries 8's payload instead.
    const wrongPayload = evaluate({ outputs: [FILLER, eventOutput(payload(EMITTED + 1), eventLock)] });
    expect(wrongPayload.accepted).toBe(false);
    expect(wrongPayload.objection).toBeDefined();
  });

  it('refuses a listed output that is somebody else\'s lock rather than the event covenant', () => {
    expect(evaluate({ outputs: [FILLER, eventOutput(payload(EMITTED), USER_LOCK)] }).accepted).toBe(false);
  });

  it('refuses a listed output carrying no token at all', () => {
    expect(evaluate({
      outputs: [FILLER, { lockingBytecode: eventLock, valueSatoshis: EVENT_VALUE }],
    }).accepted).toBe(false);
  });

  it('refuses a listed output whose category has the mutable capability', () => {
    expect(evaluate({
      outputs: [FILLER, { lockingBytecode: eventLock, valueSatoshis: EVENT_VALUE, token: token('mutable', payload(EMITTED)) }],
    }).accepted).toBe(false);
  });

  it('refuses an output index the event does not sit at', () => {
    // The record names output 2, the event sits at output 1, so output 2 is the filler with no token.
    expect(evaluate({
      block: baseBlock([2]),
      outputs: [eventOutput(payload(EMITTED), eventLock), FILLER],
    }).accepted).toBe(false);
  });

  it('refuses a body that emits a value the listed output does not carry', () => {
    // The witness lists the output for 7's payload, but the entry is called with 9, so the body computes 9's.
    const calledWithNine = evaluate({
      outputs: [FILLER, eventOutput(payload(EMITTED), eventLock)],
      argumentPushes: payload(EMITTED + 2),
    });
    expect(calledWithNine.accepted).toBe(false);
    // The control: the body called with 7 computes the payload the listed output carries.
    expect(evaluate().accepted).toBe(true);
  });
});
