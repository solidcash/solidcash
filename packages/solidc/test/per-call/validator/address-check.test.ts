import { describe, expect, it } from 'vitest';
import {
  Opcodes,
  encodeDataPush,
  encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  CONTRACT_LOCK_LENGTH,
  FrameKind,
  TokenCapability,
  categoryPin,
  chainCategory,
  encodeWitnessBlock,
  validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { addressCheckScript } from '../../../src/per-call/validator/address-check.js';
import { buildValidatorProgram } from '../../../src/per-call/validator/program.js';
import { compositionMachine } from '../machine.js';

/**
 * The self check for one covered master, on the virtual machine.
 *
 * Entry is `[pin, payload]`. The fragment consumes both and leaves nothing; this harness pushes `OP_1` after it,
 * which is the single truthy item a successful input has to leave. `pin` is the mutable category pin in chain
 * order, not a token read from the transaction.
 *
 * The sender is longer than 127 bytes so its `lp16` length has the sign bit set. A script that splits on that
 * length without clearing the sign fails the accepting cases.
 */

const category = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const program = buildValidatorProgram();
const pin = categoryPin(chainCategory(category), TokenCapability.MUTABLE);
const wrongSelf = new Uint8Array(CONTRACT_LOCK_LENGTH).fill(0x11);
const SENDER_LENGTH = 200;

const block = (overrides: Partial<WitnessBlock> = {}): WitnessBlock => ({
  kind: FrameKind.CALL,
  callerRef: 1,
  originRef: 1,
  validatorRef: 0xffff,
  sender: new Uint8Array(SENDER_LENGTH).fill(0x22),
  self: validatorAddress(category, program),
  value: 0n,
  retval: new Uint8Array(0),
  calls: [],
  segments: [[]],
  events: [],
  sends: [],
  ...overrides,
});

/** Runs the fragment against one block. `true` when the machine accepts it, otherwise the machine's objection. */
function accepted(payload: Uint8Array): string | true {
  const redeem = new Uint8Array([...addressCheckScript(program), Opcodes.OP_1]);
  const lock = encodeLockingBytecodeP2sh32(hash256(redeem));
  const vm = compositionMachine();
  const source = { lockingBytecode: lock, valueSatoshis: 10_000n };
  const transaction = {
    version: 2,
    inputs: [{
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(pin),
        ...encodeDataPush(payload),
        ...encodeDataPush(redeem),
      ]),
    }],
    outputs: [{ lockingBytecode: lock, valueSatoshis: 10_000n }],
    locktime: 0,
  };
  return vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs: [source], transaction }));
}

describe('a covered master presenting its contract address', () => {
  it('accepts a message-call frame whose self is the validator address', () => {
    expect(accepted(encodeWitnessBlock(block()))).toBe(true);
  });

  it('refuses that frame when self is not the validator address', () => {
    expect(accepted(encodeWitnessBlock(block({ self: wrongSelf })))).not.toBe(true);
  });

  it('accepts a delegate frame without checking self', () => {
    const delegate = block({ kind: FrameKind.DELEGATE, self: wrongSelf });
    expect(accepted(encodeWitnessBlock(delegate))).toBe(true);
  });

  it('refuses a user entry, a read-only frame and a create frame with the wrong self', () => {
    for (const kind of [FrameKind.ROOT, FrameKind.STATIC, FrameKind.CREATE]) {
      expect(accepted(encodeWitnessBlock(block({ kind, self: wrongSelf })))).not.toBe(true);
    }
  });

  it('accepts an internal frame without checking self', () => {
    const internal = block({ kind: FrameKind.INTERNAL, self: wrongSelf });
    expect(accepted(encodeWitnessBlock(internal))).toBe(true);
  });
});
