import { describe, expect, it } from 'vitest';
import {
  Opcodes,
  encodeDataPush,
  encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import { FrameKind, chainCategory, encodeWitnessBlock, type WitnessBlock } from '@solidcash/utils';
import { contextCategoryScript } from '../../../src/framed/validator/program.js';
import { compositionMachine } from '../machine.js';

/**
 * The context walk on the virtual machine.
 *
 * A frame entered by a delegate or internal call runs on its caller's records, so the walk has to follow the caller
 * chain to the first frame that uses its own category. The harness builds a two-input transaction and asks the walk
 * about the second input: input 0 is a user-entered frame of one contract, input 1 a frame of another that names
 * input 0 as its caller. The redeem appends the caller's chain-order category and an equality, so the input only
 * succeeds when the walk resolved the caller rather than the frame it started from.
 */

const callerCategory = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const calleeCategory = Uint8Array.from({ length: 32 }, (_, index) => 200 - index);

const masterToken = (category: Uint8Array): { category: Uint8Array; amount: bigint; nft: {
  capability: 'minting'; commitment: Uint8Array } } => ({
  category,
  amount: 0n,
  nft: { capability: 'minting', commitment: new Uint8Array(0) },
});

const block = (kind: number, callerRef: number): WitnessBlock => ({
  kind,
  callerRef,
  originRef: 0,
  validatorRef: 0xffff,
  sender: new Uint8Array(25).fill(0x33),
  self: new Uint8Array(35).fill(0x44),
  value: 0n,
  retval: new Uint8Array(0),
  calls: [],
  segments: [[]],
  events: [],
  sends: [],
});

/** Whether the walk's answer for the second input equals `candidate`. */
function answersWith(calleeKind: number, candidate: Uint8Array): boolean {
  const redeem = new Uint8Array([
    ...contextCategoryScript(),
    ...encodeDataPush(candidate),
    Opcodes.OP_EQUAL,
    Opcodes.OP_NIP,
  ]);
  const lock = encodeLockingBytecodeP2sh32(hash256(redeem));
  const vm = compositionMachine();
  const sourceOutputs = [
    { lockingBytecode: lock, valueSatoshis: 10_000n, token: masterToken(callerCategory) },
    { lockingBytecode: lock, valueSatoshis: 10_000n, token: masterToken(calleeCategory) },
  ];
  // A frame's witness block is the first push of its own unlocking bytecode, which is what the walk reads.
  const inputs = [
    { block: block(FrameKind.ROOT, 0), redeem: new Uint8Array([Opcodes.OP_1]) },
    { block: block(calleeKind, 0), redeem },
  ].map((entry, index) => ({
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(entry.block)),
      ...(index === 1 ? encodeDataPush(new Uint8Array([1])) : new Uint8Array(0)),
      ...encodeDataPush(entry.redeem),
    ]),
  }));
  const transaction = {
    version: 2,
    inputs,
    outputs: [{ lockingBytecode: lock, valueSatoshis: 20_000n }],
    locktime: 0,
  };
  return vm.stateSuccess(vm.evaluate({ inputIndex: 1, sourceOutputs, transaction })) === true;
}

describe('the context walk', () => {
  it('follows a delegate frame to its caller', () => {
    expect(answersWith(FrameKind.DELEGATE, chainCategory(callerCategory))).toBe(true);
  });

  it('follows an internal frame to its caller', () => {
    expect(answersWith(FrameKind.INTERNAL, chainCategory(callerCategory))).toBe(true);
  });

  it('answers a frame that uses its own category with that category', () => {
    // A message call keeps its own category, so it resolves to the frame it started from, not to its caller.
    expect(answersWith(FrameKind.CALL, chainCategory(calleeCategory))).toBe(true);
    expect(answersWith(FrameKind.CALL, chainCategory(callerCategory))).toBe(false);
  });

  it('follows a borrowed frame through a borrowed caller', () => {
    // The frame's caller is itself borrowed, so the walk has to take more than one step to reach the user's frame.
    const redeem = new Uint8Array([
      ...contextCategoryScript(),
      ...encodeDataPush(chainCategory(callerCategory)),
      Opcodes.OP_EQUAL,
      Opcodes.OP_NIP,
    ]);
    const lock = encodeLockingBytecodeP2sh32(hash256(redeem));
    const vm = compositionMachine();
    const sourceOutputs = [
      { lockingBytecode: lock, valueSatoshis: 10_000n, token: masterToken(callerCategory) },
      { lockingBytecode: lock, valueSatoshis: 10_000n, token: masterToken(calleeCategory) },
      { lockingBytecode: lock, valueSatoshis: 10_000n, token: masterToken(calleeCategory) },
    ];
    const inputs = [
      { block: block(FrameKind.ROOT, 0) },
      { block: block(FrameKind.INTERNAL, 0) },
      { block: block(FrameKind.DELEGATE, 1) },
    ].map((entry, index) => ({
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(entry.block)),
        ...(index === 2 ? encodeDataPush(new Uint8Array([2])) : new Uint8Array(0)),
        ...encodeDataPush(index === 2 ? redeem : new Uint8Array([Opcodes.OP_1])),
      ]),
    }));
    const transaction = {
      version: 2,
      inputs,
      outputs: [{ lockingBytecode: lock, valueSatoshis: 30_000n }],
      locktime: 0,
    };
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 2, sourceOutputs, transaction }))).toBe(true);
  });
});
