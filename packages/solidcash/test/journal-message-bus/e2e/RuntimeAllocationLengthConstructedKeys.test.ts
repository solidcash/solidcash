import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SOURCE = `contract AllocationLengthKeys() {
  mapping(int => int) records;
  function fill(int[] memory keys, int base, int stop) internal pure {
    for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
      keys[cursor] = base + cursor;
    }
  }
  function apply(int count, int base, int allocationLength) public {
    int[] memory domain = new int[](allocationLength);
    int[] memory keys = new int[](count);
    fill(keys, base, domain.length);
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[keys[cursor]] = cursor + 20;
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.records[key] == expected); }
}`;

// The legacy unroll cannot lower the otherwise unused runtime allocation. Its public length operand is the
// semantic oracle: allocation immediately captures that same value, and this family excludes every resize.
const LEGACY_SOURCE = SOURCE.replace(
  'int[] memory domain = new int[](allocationLength);\n    int[] memory keys',
  'int[] memory keys',
).replace('fill(keys, base, domain.length);', 'fill(keys, base, allocationLength);');

const compile = (kernel: boolean): ReturnType<typeof compileString> => {
  const failures: unknown[] = [];
  const artifact = compileString(kernel ? SOURCE : LEGACY_SOURCE, {
    forceStateful: true,
    messageBus: true,
    messageBusKernel: kernel,
    maximumInputBytes: 1_000_000,
    ...(kernel && {
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: { failures },
    }),
  });
  if (kernel) expect(failures).toEqual([]);
  return artifact;
};

describe('runtime allocation-length constructed keys', () => {
  it('matches legacy full and partial fills while preserving source bounds failures', async () => {
    const scenarios = [
      { count: 3n, base: 100n, length: 3n, entries: [[100n, 20n], [101n, 21n], [102n, 22n]] },
      { count: 3n, base: 200n, length: 2n, entries: [[200n, 20n], [201n, 21n], [0n, 22n], [202n, 0n]] },
    ] as const;
    for (const { count, base, length, entries } of scenarios) {
      for (const kernel of [false, true]) {
        const provider = createTestProvider();
        const artifact = compile(kernel);
        const inner = new Contract(artifact, [], { provider });
        const { categoryId } = await setupStatefulUtxos(
          provider, inner, artifact.stateLayout!, {}, { saltContract: true },
        );
        const contract = StatefulContract.withCategory(inner, categoryId);
        if (kernel) {
          expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
            .toContain('OP_INVOKE');
          expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
            .toMatchObject({ eligible: true });
        }
        const apply = kernel
          ? contract.batch([{ function: 'apply', args: [count, base, length] }])
          : contract.call.apply(count, base, length);
        await expect(apply.send()).resolves.toBeDefined();
        for (const [key, expected] of entries) {
          await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
        }
      }
    }

    for (const kernel of [false, true]) {
      const provider = createTestProvider();
      const artifact = compile(kernel);
      const inner = new Contract(artifact, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, inner, artifact.stateLayout!, {}, { saltContract: true },
      );
      const contract = StatefulContract.withCategory(inner, categoryId);
      const apply = kernel
        ? contract.batch([{ function: 'apply', args: [2n, 300n, 3n] }])
        : contract.call.apply(2n, 300n, 3n);
      await expect(apply.send()).rejects.toThrow();
    }
  }, 180_000);
});
