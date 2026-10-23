import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const source = (kernel: boolean): string => `contract ExhaustiveResizeJoinKeys() {
  mapping(int => int) records;
  function fill(int[] memory keys, int base, int stop) internal pure {
    for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
      keys[cursor] = base + cursor;
    }
  }
  function apply(int count, int base, int allocationLength, bool choose) public {
    ${kernel ? `int[] memory domain = new int[](allocationLength);
    if (choose) {
      domain.push(base + 20);
    } else {
      domain.push(base + 30);
      domain.push(base + 31);
    }` : ''}
    int[] memory keys = new int[](count);
    fill(keys, base, ${kernel ? 'domain.length' : 'allocationLength + (choose ? 1 : 2)'});
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[keys[cursor]] = cursor + 40;
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

describe('exhaustive finite resize joins', () => {
  it('matches legacy for either exact arm and preserves source bounds failures', async () => {
    const scenarios = [
      {
        choose: true, count: 3n, base: 700n, length: 2n,
        entries: [[700n, 40n], [701n, 41n], [702n, 42n]],
      },
      {
        choose: false, count: 3n, base: 800n, length: 1n,
        entries: [[800n, 40n], [801n, 41n], [802n, 42n]],
      },
      {
        choose: true, count: 3n, base: 900n, length: 1n,
        entries: [[900n, 40n], [901n, 41n], [0n, 42n]],
      },
    ] as const;
    for (const { choose, count, base, length, entries } of scenarios) {
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
          ? contract.batch([{ function: 'apply', args: [count, base, length, choose] }])
          : contract.call.apply(count, base, length, choose);
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
        ? contract.batch([{ function: 'apply', args: [2n, 1000n, 2n, false] }])
        : contract.call.apply(2n, 1000n, 2n, false);
      await expect(apply.send()).rejects.toThrow();
    }
  }, 180_000);
});
