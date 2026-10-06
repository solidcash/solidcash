/**
 * The composition machine's limit profile.
 *
 * The suites run on a machine whose per-input byte allowance and operation-cost density are relaxed, and this pins
 * that fact: a transaction libauth's stock machine refuses for carrying more unlocking bytecode than a real chain
 * allows is accepted on the profile the framed suites use. Without this, a suite could pass while quietly being
 * gated by the profile it was supposed to have been freed from.
 */

import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026, encodeDataPush } from '@bitauth/libauth';
import { compositionMachine } from './machine.js';

/** A transaction whose single input pushes `bytes` of data and whose source output just drops it. */
function pushEverything(bytes: number): Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0] {
  return {
    inputIndex: 0,
    sourceOutputs: [{ lockingBytecode: Uint8Array.from([0x75, 0x51]), valueSatoshis: 1_000n }],
    transaction: {
      version: 2,
      locktime: 0,
      inputs: [{
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: encodeDataPush(new Uint8Array(bytes)),
      }],
      outputs: [{ lockingBytecode: Uint8Array.from([0x75, 0x51]), valueSatoshis: 1_000n }],
    },
  };
}

function accepted(machine: ReturnType<typeof createVirtualMachineBch2026>, bytes: number): boolean {
  const program = pushEverything(bytes);
  return machine.stateSuccess(machine.evaluate(program)) === true;
}

describe('the composition machine profile', () => {
  it('refuses on the stock machine a transaction carrying more unlocking bytecode than a chain allows', () => {
    expect(accepted(createVirtualMachineBch2026(false), 20_000)).toBe(false);
  });

  it('accepts the same transaction on the composition profile', () => {
    expect(accepted(compositionMachine(), 20_000)).toBe(true);
  });

  it('still decides the script rather than accepting everything', () => {
    // A source output that leaves a falsey item is refused whatever the profile: the machine decides the script.
    const empty: Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0] = {
      inputIndex: 0,
      sourceOutputs: [{ lockingBytecode: Uint8Array.from([0x00]), valueSatoshis: 1_000n }],
      transaction: {
        version: 2,
        locktime: 0,
        inputs: [{
          outpointIndex: 0,
          outpointTransactionHash: new Uint8Array(32),
          sequenceNumber: 0xffffffff,
          unlockingBytecode: new Uint8Array(0),
        }],
        outputs: [{ lockingBytecode: Uint8Array.from([0x75, 0x51]), valueSatoshis: 1_000n }],
      },
    };
    const machine = compositionMachine();
    expect(machine.stateSuccess(machine.evaluate(empty))).not.toBe(true);
  });
});
