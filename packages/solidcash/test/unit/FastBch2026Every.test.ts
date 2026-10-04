import { describe, expect, it } from 'vitest';
import { createInstructionSetBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-instruction-set.js';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import { installFastBch2026Every } from '../../src/network/createVirtualMachine.js';

const program = {
  inputIndex: 0,
  sourceOutputs: [{ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_200n }],
  transaction: {
    version: 2,
    locktime: 0,
    inputs: [{
      outpointTransactionHash: new Uint8Array(32), outpointIndex: 0,
      sequenceNumber: 0xffff_ffff, unlockingBytecode: new Uint8Array(),
    }],
    outputs: [{ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_200n }],
  },
};

type InstructionSet = ReturnType<typeof createInstructionSetBch2026>;
type VmState = Parameters<NonNullable<InstructionSet['every']>>[0];
const makeState = (instructionSet: InstructionSet): VmState => ({
  ...instructionSet.initialize!(program as never), instructions: [], program, stack: [],
}) as VmState;

describe('fast BCH-2026 instruction accounting', () => {
  it('matches libauth at normal and consensus-limit states', () => {
    const cases: Array<{ name: string; standard: boolean; change: (state: VmState) => void }> = [
      { name: 'normal', standard: true, change: (state) => { state.metrics.evaluatedInstructionCount = 2; } },
      { name: 'operation cost', standard: true, change: (state) => {
        state.metrics.evaluatedInstructionCount = 2;
        state.metrics.maximumOperationCost = 100;
      } },
      { name: 'hashing', standard: true, change: (state) => {
        state.metrics.maximumOperationCost = 1_000_000;
        state.metrics.hashDigestIterations = state.metrics.maximumHashDigestIterations + 1;
      } },
      { name: 'stack and memory', standard: true, change: (state) => {
        state.stack = Array.from({ length: ConsensusBch2026.maximumStackDepth + 1 }, () => new Uint8Array());
      } },
      { name: 'control stack', standard: true, change: (state) => {
        state.controlStack = Array.from({ length: ConsensusBch2026.maximumControlStackDepth + 1 }, () => false);
      } },
      { name: 'signature checks', standard: true, change: (state) => {
        state.metrics.maximumOperationCost = 1_000_000;
        state.metrics.signatureCheckCount = state.metrics.maximumSignatureCheckCount + 1;
      } },
      { name: 'nonstandard signature checks', standard: false, change: (state) => {
        state.metrics.maximumOperationCost = 1_000_000;
        state.metrics.signatureCheckCount = state.metrics.maximumSignatureCheckCount + 1;
      } },
      { name: 'function memory slots', standard: true, change: (state) => {
        state.functionCount = ConsensusBch2026.maximumMemorySlots + 1;
      } },
      { name: 'prior error', standard: true, change: (state) => { state.error = 'prior error'; } },
    ];
    for (const row of cases) {
      const original = createInstructionSetBch2026(row.standard);
      const fast = createInstructionSetBch2026(row.standard);
      installFastBch2026Every(fast, ConsensusBch2026, row.standard);
      const originalState = makeState(original);
      const fastState = makeState(fast);
      row.change(originalState);
      row.change(fastState);
      expect(fast.every!(fastState), row.name).toEqual(original.every!(originalState));
    }
  });
});
