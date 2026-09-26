import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import { encodeWitnessBlock, type WitnessBlock } from '@solidcash/utils';
import { witnessBlockShapeScript } from '../../../src/per-call/validator/program.js';

/**
 * The witness-block walk the validator program runs on each covered master.
 *
 * The cases encode a block with the shipped codec and ask the machine to consume it. A block the codec accepts
 * must be consumed exactly, and a block the codec would reject must fail the script.
 */

const block = (overrides: Partial<WitnessBlock> = {}): WitnessBlock => ({
  kind: 0,
  callerRef: 1,
  originRef: 1,
  validatorRef: 0xffff,
  sender: new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]),
  self: new Uint8Array([0xaa, 0x20, ...new Uint8Array(32).fill(0x33), 0x87]),
  value: 0n,
  retval: new Uint8Array(0),
  calls: [],
  segments: [[]],
  events: [],
  sends: [],
  ...overrides,
});

const call = {
  kind: 1,
  target: new Uint8Array([0xaa, 0x20, ...new Uint8Array(32).fill(0x44), 0x87]),
  value: 0n,
  calleeRef: 2,
  argsHash: new Uint8Array(32).fill(0x55),
  result: new Uint8Array(0),
};

function accepted(payload: Uint8Array): boolean {
  const redeem = witnessBlockShapeScript();
  const lock = encodeLockingBytecodeP2sh32(hash256(redeem));
  const vm = createVirtualMachineBch2026(false);
  const source = { lockingBytecode: lock, valueSatoshis: 10_000n };
  const transaction = {
    version: 2,
    inputs: [{
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([...encodeDataPush(payload), ...encodeDataPush(redeem)]),
    }],
    outputs: [{ lockingBytecode: lock, valueSatoshis: 10_000n }],
    locktime: 0,
  };
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs: [source], transaction });
  return vm.stateSuccess(state) === true;
}

describe('a witness block consumed by the validator walk', () => {
  it('accepts a block with no calls and one empty segment', () => {
    expect(accepted(encodeWitnessBlock(block()))).toBe(true);
  });

  it('accepts a call, a kept record, an event and a send', () => {
    const payload = encodeWitnessBlock(block({
      calls: [call],
      segments: [[], [{ in: 3, out: 3, viewIn: new Uint8Array([0x01]), viewOut: new Uint8Array([0x02]) }]],
      events: [4],
      sends: [5],
    }));
    expect(accepted(payload)).toBe(true);
  });

  it('accepts a record that is created and one that is deleted', () => {
    const payload = encodeWitnessBlock(block({
      segments: [[{
        in: 0xffff, out: 4, viewIn: new Uint8Array(0), viewOut: new Uint8Array([0x09]),
      }, {
        in: 5, out: 0xffff, viewIn: new Uint8Array([0x08]), viewOut: new Uint8Array(0),
      }]],
    }));
    expect(accepted(payload)).toBe(true);
  });

  it('refuses a bad magic, a trailing byte and a truncated block', () => {
    const payload = encodeWitnessBlock(block());
    const badMagic = Uint8Array.from(payload);
    badMagic[0] = 0x00;
    expect(accepted(badMagic)).toBe(false);
    expect(accepted(new Uint8Array([...payload, 0x00]))).toBe(false);
    expect(accepted(payload.subarray(0, payload.length - 1))).toBe(false);
  });
});
