import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const source = (kernel: boolean): string => `contract FixedLoopResizeKeys() {
  mapping(int => int) records;
  function fill(int[] memory keys, int base, int stop) internal pure {
    for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
      keys[cursor] = base + cursor;
    }
  }
  function apply(int count, int base, int allocationLength) public {
    ${kernel ? `int[] memory domain = new int[](allocationLength);
    for (int round = 0; round < 3; round = round + 1) {
      domain.push(base + round);
      domain.push(base + 10 + round);
      domain.pop();
    }` : ''}
    int[] memory keys = new int[](count);
    fill(keys, base, ${kernel ? 'domain.length' : 'allocationLength + 3'});
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[keys[cursor]] = cursor + 60;
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.records[key] == expected); }
}`;

const compile = (kernel: boolean): ReturnType<typeof compileString> => {
  const failures: unknown[] = [];
  const artifact = compileString(source(kernel), {
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

describe('fixed-count source-loop resize schedules', () => {
  it('matches the exact legacy length and preserves source bounds failures', async () => {
    const scenarios = [
      {
        count: 4n, base: 1500n, length: 1n,
        entries: [[1500n, 60n], [1501n, 61n], [1502n, 62n], [1503n, 63n]],
      },
      {
        count: 4n, base: 1600n, length: 0n,
        entries: [[1600n, 60n], [1601n, 61n], [1602n, 62n], [0n, 63n]],
      },
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
        ? contract.batch([{ function: 'apply', args: [2n, 1700n, 0n] }])
        : contract.call.apply(2n, 1700n, 0n);
      await expect(apply.send()).rejects.toThrow();
    }
  }, 180_000);
});
