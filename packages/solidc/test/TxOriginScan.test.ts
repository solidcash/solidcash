import { describe, expect, it } from 'vitest';
import { decodeAuthenticationInstructions, hexToBin } from '@bitauth/libauth';
import { createVirtualMachineBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-vm.js';
import { asmToBytecode } from '@solidcash/utils';
import { compileString } from '../src/index.js';

describe('tx.origin input scan', () => {
  it('filters self, token-bearing and malformed candidates and chooses the first eligible P2PKH', () => {
    const artifact = compileString('contract Origin() { function check(address expected) { require(tx.origin == expected); } }',
      { messageBus: false });
    const instructions = decodeAuthenticationInstructions(asmToBytecode(artifact.bytecode));
    const vm = createVirtualMachineBch2026();
    type Program = Parameters<typeof vm.evaluate>[0];
    type Output = Program['sourceOutputs'][number];
    const p2pkh = (byte: string): Uint8Array => hexToBin(`76a914${byte.repeat(20)}88ac`);
    const first = p2pkh('11');
    const last = p2pkh('22');
    const output = (lockingBytecode: Uint8Array, token = false): Output => ({
      lockingBytecode, valueSatoshis: 1000n,
      ...(token && { token: { category: new Uint8Array(32), amount: 1n } }),
    });
    const evaluate = (sourceOutputs: Output[], expected: Uint8Array): true | string => {
      const program: Program = {
        inputIndex: 0,
        sourceOutputs,
        transaction: {
          version: 2, locktime: 0,
          inputs: sourceOutputs.map((_source, index) => ({
            outpointTransactionHash: new Uint8Array(32), outpointIndex: index, sequenceNumber: 0xffffffff,
            unlockingBytecode: new Uint8Array(1000),
          })),
          outputs: [output(Uint8Array.of(0x51))],
        },
      };
      // Evaluate the emitted checker directly so its active source can itself be a P2PKH candidate.
      // This exercises the intrinsic's self exclusion without requiring a P2PKH spend to execute a contract.
      return vm.stateSuccess(vm.stateEvaluate({
        ...vm.stateInitialize(program), instructions, program, stack: [expected],
      } as ReturnType<typeof vm.evaluate>));
    };
    const rejected = [
      output(first), // active input is excluded even when its script is P2PKH
      output(hexToBin(`76a914${'33'.repeat(20)}88ad`)), // wrong suffix
      output(first, true),
      output(hexToBin(`75a914${'44'.repeat(20)}88ac`)), // wrong prefix
      output(Uint8Array.of(0x51)),
    ];
    expect(evaluate([...rejected, output(first), output(last)], first)).toBe(true);
    expect(evaluate([...rejected, output(first), output(last)], last)).not.toBe(true);
    expect(evaluate(rejected, first)).not.toBe(true);
  });
});
